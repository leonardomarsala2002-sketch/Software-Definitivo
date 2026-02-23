import { useMemo, useState } from "react";
import { Calendar, Clock, Sun, Bell, User, Store, Check, X, ChevronLeft, ChevronRight, Scissors } from "lucide-react";
import { format, parseISO, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStoreRequests, useReviewRequest } from "@/hooks/useRequests";
import { useEmployeeList } from "@/hooks/useEmployees";
import { toast } from "sonner";

interface PersonalShift {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  department: "sala" | "cucina";
  is_day_off: boolean;
  status: "draft" | "published" | "archived";
  store_id: string;
}

// Card base style with 32px border-radius and soft shadow
const cardBaseClass = "rounded-[2rem] border border-border/40 bg-card/95 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.3)] backdrop-blur-sm";

function usePersonalShifts(userId: string | undefined) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(addMonths(now, 1));

  return useQuery({
    queryKey: ["personal-shifts-dashboard", userId],
    queryFn: async (): Promise<PersonalShift[]> => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, department, is_day_off, status, store_id")
        .eq("user_id", userId!)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"))
        .in("status", ["published", "draft"])
        .order("date")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as PersonalShift[];
    },
    enabled: !!userId,
  });
}

// Hook for employee vacation balance
function useVacationBalance(userId: string | undefined) {
  return useQuery({
    queryKey: ["vacation-balance", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_details")
        .select("vacation_days_total, vacation_days_used, permission_hours_total, permission_hours_used")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { vacation_days_total: 26, vacation_days_used: 0, permission_hours_total: 40, permission_hours_used: 0 };
    },
    enabled: !!userId,
  });
}

// Circular progress component for vacation counter
function CircularProgress({ value, max, label, unit }: { value: number; max: number; label: string; unit: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const remaining = max - value;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90 transform">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-muted/30"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="text-teal-500 dark:text-teal-400 transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{remaining}</span>
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        </div>
      </div>
      <span className="mt-2 text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

const Dashboard = () => {
  const { user, role, activeStore } = useAuth();
  const isAdmin = role === "super_admin" || role === "admin";
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: shifts = [] } = usePersonalShifts(user?.id);
  const { data: vacationData } = useVacationBalance(user?.id);
  const { data: storeRequests = [] } = useStoreRequests(isAdmin ? activeStore?.id : undefined);
  const { data: employees = [] } = useEmployeeList();
  const reviewRequest = useReviewRequest();

  // Build profile map for displaying requester names
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.user_id, e.full_name ?? e.email ?? ""));
    return m;
  }, [employees]);

  const pendingRequests = storeRequests.filter(r => r.status === "pending");

  // Handle request approval
  const handleApprove = (requestId: string) => {
    if (!user?.id) return;
    reviewRequest.mutate({ id: requestId, status: "approved", reviewedBy: user.id });
  };

  // Handle request rejection
  const handleReject = (requestId: string) => {
    if (!user?.id) return;
    reviewRequest.mutate({ id: requestId, status: "rejected", reviewedBy: user.id });
  };

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, PersonalShift[]>();
    shifts.forEach(s => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [shifts]);

  // Get shifts for selected date
  const selectedDateShifts = useMemo(() => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return shiftsByDate.get(dateStr) ?? [];
  }, [selectedDate, shiftsByDate]);

  // Calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Pad start of month to align with Monday
    const startDay = getDay(start);
    const paddingStart = startDay === 0 ? 6 : startDay - 1;
    const padding = Array(paddingStart).fill(null);
    
    return [...padding, ...days];
  }, [currentMonth]);

  // Get user display info
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Utente";
  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  const roleLabelMap: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Manager",
    employee: "Dipendente",
  };

  // Get today's shift info
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayShifts = shiftsByDate.get(todayStr) ?? [];
  const todaySchedule = todayShifts.length > 0 && !todayShifts[0].is_day_off
    ? `${todayShifts[0].start_time?.slice(0, 5) ?? "N/A"} - ${todayShifts[0].end_time?.slice(0, 5) ?? "N/A"}`
    : todayShifts.length > 0 && todayShifts[0].is_day_off
    ? "Riposo"
    : "Nessun turno";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Bento Grid - 100vh without scroll */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 p-4">
        {/* Left Column - Calendar Widget (2/3 width on desktop) */}
        <div className={`${cardBaseClass} lg:col-span-2 flex flex-col overflow-hidden`}>
          <CardHeader className="px-5 py-4 pb-2 flex flex-row items-center justify-between shrink-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <span className="text-xl">📅</span>
              Calendario
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: it })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col px-5 py-3 min-h-0 overflow-auto">
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(day => (
                <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 flex-1">
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="aspect-square" />;
                }

                const dateStr = format(day, "yyyy-MM-dd");
                const dayShifts = shiftsByDate.get(dateStr) ?? [];
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedDate);
                const hasShift = dayShifts.length > 0;
                const isDayOff = dayShifts.some(s => s.is_day_off);
                const isSplit = dayShifts.filter(s => !s.is_day_off).length > 1;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square rounded-xl flex flex-col items-center justify-center transition-all text-xs relative",
                      isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                      isToday && !isSelected && "bg-primary/10",
                      !isSelected && !isToday && "hover:bg-accent/50"
                    )}
                  >
                    <span className={cn(
                      "font-medium",
                      isToday && "text-primary font-bold",
                      isDayOff && "text-destructive"
                    )}>
                      {format(day, "d")}
                    </span>
                    {hasShift && (
                      <div className="flex gap-0.5 mt-0.5">
                        {isDayOff ? (
                          <div className="h-1.5 w-1.5 rounded-full bg-destructive/60" />
                        ) : isSplit ? (
                          <>
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          </>
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected day details */}
            <div className="mt-3 pt-3 border-t border-border/40 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold capitalize">
                  {format(selectedDate, "EEEE d MMMM", { locale: it })}
                </span>
                {isSameDay(selectedDate, new Date()) && (
                  <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">Oggi</Badge>
                )}
              </div>
              
              {selectedDateShifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun turno programmato</p>
              ) : selectedDateShifts[0].is_day_off ? (
                <div className="flex items-center gap-2 text-destructive">
                  <Sun className="h-4 w-4" />
                  <span className="text-sm font-medium">Giorno di riposo</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {selectedDateShifts.filter(s => !s.is_day_off).map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="text-base font-semibold tabular-nums">
                        {s.start_time?.slice(0, 5) ?? "N/A"} – {s.end_time?.slice(0, 5) ?? "N/A"}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                        {s.department}
                      </Badge>
                      {selectedDateShifts.filter(sh => !sh.is_day_off).length > 1 && (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 ml-auto">
                          <Scissors className="h-3 w-3" />
                          <span className="text-[10px] font-medium">Spezzato</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </div>

        {/* Right Column - Stacked Cards */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* User Profile Card */}
          <Card className={`${cardBaseClass} shrink-0`}>
            <CardContent className="p-4 flex items-center gap-4">
              <Avatar className="h-14 w-14 shadow-md ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground truncate">{displayName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 h-5">
                    {roleLabelMap[role ?? "employee"] || role}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Oggi: {todaySchedule}</span>
                </div>
                {activeStore && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Store className="h-3 w-3" />
                    <span className="truncate">{activeStore.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vacation/Ferie Widget */}
          <Card className={`${cardBaseClass} flex-1 min-h-0`}>
            <CardHeader className="px-4 py-3 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="text-base">🏖️</span>
                Ferie & Permessi
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-2 flex justify-around items-center">
              <CircularProgress
                value={vacationData?.vacation_days_used ?? 0}
                max={vacationData?.vacation_days_total ?? 26}
                label="Ferie residue"
                unit="giorni"
              />
              <CircularProgress
                value={vacationData?.permission_hours_used ?? 0}
                max={vacationData?.permission_hours_total ?? 40}
                label="Permessi residui"
                unit="ore"
              />
            </CardContent>
          </Card>

          {/* Admin Alerts Panel - Only visible for admins */}
          {isAdmin && (
            <Card className={`${cardBaseClass} flex-1 min-h-0 flex flex-col`}>
              <CardHeader className="px-4 py-3 pb-2 shrink-0">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="text-base">🔔</span>
                  Richieste Pendenti
                  {pendingRequests.length > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0 h-4">
                      {pendingRequests.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-2 flex-1 overflow-auto">
                {pendingRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="text-2xl mb-2">✨</div>
                    <p className="text-sm text-muted-foreground">Nessuna richiesta in attesa</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.slice(0, 5).map(req => {
                      const requesterName = profileMap.get(req.user_id) || "Dipendente";
                      return (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {requesterName}
                            </p>
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {req.request_type.replace(/_/g, " ")} · {format(parseISO(req.request_date), "d MMM", { locale: it })}
                            </p>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-600"
                              onClick={() => handleApprove(req.id)}
                              disabled={reviewRequest.isPending}
                              title="Accetta richiesta"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive"
                              onClick={() => handleReject(req.id)}
                              disabled={reviewRequest.isPending}
                              title="Rifiuta richiesta"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
