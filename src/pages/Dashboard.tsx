import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Users,
  Clock,
  Inbox,
  TrendingUp,
  TrendingDown,
  Bell,
  Plus,
  MessageSquare,
  Globe,
  Store,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import RequestForm from "@/components/requests/RequestForm";
import { useQuery } from "@tanstack/react-query";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { TeamHoursCard } from "@/components/dashboard/TeamHoursCard";
import { VacationBalanceCard } from "@/components/dashboard/VacationBalanceCard";
import { useAppointments, useRespondAppointment, useCancelAppointment } from "@/hooks/useAppointments";
import { AppointmentFormDialog } from "@/components/dashboard/AppointmentFormDialog";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { getShiftColor, formatEndTime } from "@/lib/shiftColors";

/* ── helpers ─────────────────────────────────────────── */

const DAYS_FULL_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const DAYS_IT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS_IT = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre",
];

function buildCalendarGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  let startIdx = first.getDay() - 1;
  if (startIdx < 0) startIdx = 6;
  const cells: (number | null)[] = Array(startIdx).fill(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getWeekDates(base: Date) {
  const day = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const TIMELINE_HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

/* ── KPI card component ──────────────────────────────── */

interface KpiCardProps {
  title: string;
  value: string | number;
  trend: number;
  period: string;
  icon: React.ReactNode;
}

function KpiCard({ title, value, trend, period, icon }: KpiCardProps) {
  const isPositive = trend >= 0;
  return (
    <Card className="p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge
            className={`text-[10px] font-semibold px-1.5 py-0 gap-0.5 border-0 ${
              isPositive
                ? "bg-primary/15 text-primary"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{trend}%
          </Badge>
          <span className="text-[10px] text-muted-foreground">{period}</span>
        </div>
      </div>
    </Card>
  );
}

/* ── component ───────────────────────────────────────── */

const Dashboard = () => {
  const { user, role, activeStore, stores } = useAuth();
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<{ id: string; created_by: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [viewAllStores, setViewAllStores] = useState(false);
  const isSuperAdmin = role === "super_admin";

  const { data: myDetails } = useQuery({
    queryKey: ["my-employee-details", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_details")
        .select("department")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  const department = (myDetails?.department as "sala" | "cucina") ?? "sala";

  const today = useMemo(() => new Date(), []);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const calendarCells = useMemo(() => buildCalendarGrid(calYear, calMonth), [calYear, calMonth]);
  const weekBaseDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [today, weekOffset]);
  const weekDates = useMemo(() => getWeekDates(weekBaseDate), [weekBaseDate]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const isAdmin = role === "admin" || role === "super_admin";

  const { data: appointments = [] } = useAppointments(calMonth, calYear);
  const respondAppointment = useRespondAppointment();
  const cancelAppointment = useCancelAppointment();

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;

  const { data: weekShifts = [] } = useQuery({
    queryKey: ["my-week-shifts", user?.id, weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("user_id", user!.id)
        .gte("date", weekStartStr)
        .lte("date", weekEndStr)
        .order("date")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  /* ── Real KPI queries ── */
  const { data: activeEmployeeCount = 0 } = useQuery({
    queryKey: ["kpi-active-employees", activeStore?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_store_assignments")
        .select("*", { count: "exact", head: true })
        .eq("store_id", activeStore!.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!activeStore?.id,
  });

  const thisWeekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((day + 6) % 7));
    return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
  }, []);
  const thisWeekEnd = useMemo(() => {
    const d = new Date(thisWeekStart);
    d.setDate(d.getDate() + 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [thisWeekStart]);

  const { data: weeklyTeamHours = 0 } = useQuery({
    queryKey: ["kpi-weekly-hours", activeStore?.id, thisWeekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("start_time, end_time")
        .eq("store_id", activeStore!.id)
        .eq("is_day_off", false)
        .gte("date", thisWeekStart)
        .lte("date", thisWeekEnd);
      if (error) throw error;
      return (data ?? []).reduce((sum, s) => {
        if (!s.start_time || !s.end_time) return sum;
        const sh = parseInt(s.start_time.split(":")[0]);
        let eh = parseInt(s.end_time.split(":")[0]);
        if (eh === 0) eh = 24;
        return sum + Math.max(0, eh - sh);
      }, 0);
    },
    enabled: !!activeStore?.id,
  });

  const { data: pendingRequestsCount = 0 } = useQuery({
    queryKey: ["kpi-pending-requests", activeStore?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("time_off_requests")
        .select("*", { count: "exact", head: true })
        .eq("store_id", activeStore!.id)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!activeStore?.id && !isSuperAdmin,
  });

  const kpis: KpiCardProps[] = [
    {
      title: "Dipendenti attivi",
      value: activeEmployeeCount,
      trend: 0,
      period: "store attuale",
      icon: <Users className="h-4 w-4" />,
    },
    {
      title: "Ore settimanali",
      value: `${weeklyTeamHours}h`,
      trend: 0,
      period: "settimana corrente",
      icon: <Clock className="h-4 w-4" />,
    },
    ...(isSuperAdmin ? [] : [{
      title: "Richieste pendenti",
      value: pendingRequestsCount,
      trend: 0,
      period: "in attesa",
      icon: <Inbox className="h-4 w-4" />,
    }]),
  ];

  const appointmentDays = useMemo(() => {
    if (!isAdmin) return new Set<number>();
    const set = new Set<number>();
    appointments.forEach((a) => {
      const d = new Date(a.appointment_date);
      if (d.getMonth() === calMonth && d.getFullYear() === calYear) set.add(d.getDate());
    });
    return set;
  }, [appointments, calMonth, calYear, isAdmin]);

  // Employee appointments (read-only)
  const employeeAppointmentDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
  const employeeSelectedDayAppointments = appointments.filter((a) => a.appointment_date === employeeAppointmentDateStr);


  /* ── Employee-only dashboard ── */
  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col overflow-y-auto scrollbar-hide gap-5 pb-6 animate-in fade-in duration-500">
        {/* Vacation Balance - Employee only */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-shrink-0">
          <VacationBalanceCard />
        </div>

        {/* Weekly Timeline */}
        <Card className="p-4 flex flex-col flex-shrink-0">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              Il mio orario settimanale
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setWeekOffset((o) => o - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-normal text-muted-foreground min-w-[120px] text-center">
                  {weekDates[0].getDate()} – {weekDates[6].getDate()} {MONTHS_IT[weekDates[6].getMonth()]}
                </span>
                <button onClick={() => setWeekOffset((o) => o + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
                {weekOffset !== 0 && (
                  <button onClick={() => setWeekOffset(0)} className="ml-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors px-2 py-0.5 rounded-md bg-primary/10">
                    Oggi
                  </button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex mb-1">
              <div className="w-20 shrink-0" />
              <div className="flex-1 flex">
                {TIMELINE_HOURS.map((h) => (
                  <div key={h} className="text-[10px] text-muted-foreground font-medium text-center" style={{ width: `${100 / TIMELINE_HOURS.length}%` }}>
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              {weekDates.map((d, i) => {
                const isDayToday = d.toDateString() === today.toDateString();
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                const dayShifts = weekShifts.filter((s) => s.date === dateStr);
                const isDayOff = dayShifts.some((s) => s.is_day_off);
                return (
                  <div key={i} className="flex items-center min-h-[28px]">
                    <div className={`w-20 shrink-0 pr-2 text-right text-xs font-medium ${isDayToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      <span className={isDayToday ? "bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-[11px]" : ""}>
                        {DAYS_FULL_IT[i].slice(0, 3)} {d.getDate()}
                      </span>
                    </div>
                    <div className="flex-1 relative h-6 bg-secondary rounded-lg overflow-hidden border border-border">
                      {TIMELINE_HOURS.map((h, hi) => (
                        <div key={h} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: `${(hi / TIMELINE_HOURS.length) * 100}%` }} />
                      ))}
                      {isDayOff ? (
                        <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-destructive">RIPOSO</span>
                        </div>
                      ) : (
                        dayShifts.filter((s) => !s.is_day_off && s.start_time && s.end_time).map((s) => {
                          const sH = parseInt(s.start_time!.split(":")[0]);
                          let eH = parseInt(s.end_time!.split(":")[0]);
                          if (eH === 0) eH = 24;
                          const totalSpan = TIMELINE_HOURS[TIMELINE_HOURS.length - 1] + 1 - TIMELINE_HOURS[0];
                          const left = ((sH - TIMELINE_HOURS[0]) / totalSpan) * 100;
                          const width = ((eH - sH) / totalSpan) * 100;
                          return (
                            (() => {
                              const color = getShiftColor(s);
                              return (
                                <div key={s.id} className={`absolute top-0.5 bottom-0.5 rounded-md ${color.bg} border ${color.border} flex items-center justify-center`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}>
                                  <span className={`text-[10px] font-semibold ${color.text}`}>{s.start_time?.slice(0, 5)}–{formatEndTime(s.end_time)}</span>
                                </div>
                              );
                            })()
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Request + Calendar + Appointments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0">
          {/* New Request */}
          <Card className="p-4 flex flex-col">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                  <Inbox className="h-4 w-4 text-primary" />
                </div>
                Nuova Richiesta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activeStore?.id ? (
                <RequestForm department={department} storeId={activeStore.id} onClose={() => {}} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nessuno store assegnato.</p>
              )}
            </CardContent>
          </Card>

          {/* Monthly Calendar */}
          <Card className="p-4 flex flex-col">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-semibold">
                <span>{MONTHS_IT[calMonth]} {calYear}</span>
                <div className="flex gap-1">
                  <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <div className="grid grid-cols-7 mb-2">
                {DAYS_IT.map((d, i) => (
                  <span key={d} className={`text-center text-[11px] font-medium text-muted-foreground ${i >= 5 ? "opacity-50" : ""}`}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1 flex-1">
                {calendarCells.map((day, idx) => {
                  const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                  const isSelected = day !== null && selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear;
                  const isWeekend = idx % 7 >= 5;
                  return (
                    <button key={idx} disabled={day === null} onClick={() => day !== null && setSelectedDate(new Date(calYear, calMonth, day))}
                      className={`flex items-center justify-center w-full aspect-square rounded-lg text-sm transition-colors
                        ${day === null ? "invisible" : ""} ${isSelected ? "bg-primary text-primary-foreground font-bold" : ""}
                        ${isToday && !isSelected ? "bg-primary/15 text-primary font-bold" : ""}
                        ${!isToday && !isSelected && day !== null ? "hover:bg-accent text-foreground/70 font-medium" : ""}
                        ${isWeekend && !isSelected && !isToday ? "opacity-50" : ""}
                      `}>{day}</button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Appointments */}
        <Card className="p-4 flex flex-col flex-shrink-0">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              I miei appuntamenti – {selectedDate.getDate()} {MONTHS_IT[selectedDate.getMonth()]}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {employeeSelectedDayAppointments.length > 0 ? (
              <div className="space-y-2">
                {employeeSelectedDayAppointments.map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    currentUserId={user?.id}
                    onAccept={(a) => {
                      respondAppointment.mutate({ id: a.id, status: "accepted", created_by: a.created_by });
                      toast.success("Appuntamento accettato");
                    }}
                    onDecline={(a) => setDeclineTarget({ id: a.id, created_by: a.created_by })}
                    onCancel={(a) => {
                      cancelAppointment.mutate({ id: a.id, target_user_id: a.target_user_id });
                      toast.success("Appuntamento annullato");
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarIcon className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nessun appuntamento per questo giorno</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Decline reason dialog (employee) */}
        <AlertDialog open={!!declineTarget} onOpenChange={(open) => { if (!open) { setDeclineTarget(null); setDeclineReason(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-destructive" />
                Rifiuta appuntamento
              </AlertDialogTitle>
              <AlertDialogDescription>
                Scrivi una motivazione per il rifiuto (opzionale).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              placeholder="Es. Ho un impegno in quel giorno..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setDeclineTarget(null); setDeclineReason(""); }}>Annulla</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (declineTarget) {
                    respondAppointment.mutate({
                      id: declineTarget.id,
                      status: "declined",
                      created_by: declineTarget.created_by,
                      decline_reason: declineReason.trim() || undefined,
                    });
                    toast.success("Appuntamento rifiutato");
                    setDeclineTarget(null);
                    setDeclineReason("");
                  }
                }}
              >
                Conferma rifiuto
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  /* ── Admin/Super Admin dashboard ── */
  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
  const selectedDayAppointments = appointments.filter((a) => a.appointment_date === selectedDateStr);


  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-hide gap-5 pb-6 animate-in fade-in duration-500">
      {/* Super admin: store toggle */}
      {isSuperAdmin && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {viewAllStores ? "Tutti i locali" : (activeStore?.name ?? "Store selezionato")}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Label htmlFor="view-toggle" className="text-xs text-muted-foreground">Tutti i locali</Label>
            <Switch
              id="view-toggle"
              checked={viewAllStores}
              onCheckedChange={setViewAllStores}
            />
            <Globe className={`h-4 w-4 transition-colors ${viewAllStores ? "text-primary" : "text-muted-foreground/40"}`} />
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className={`flex gap-3 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory flex-shrink-0 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:overflow-visible ${isSuperAdmin ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {kpis.map((kpi) => (
          <div key={kpi.title} className="min-w-[160px] snap-start md:min-w-0">
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      {/* Team Hours + Vacation Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-shrink-0">
        <div className="lg:col-span-2">
          <TeamHoursCard />
        </div>
        <div className="flex flex-col gap-4">
          {role === "admin" && <VacationBalanceCard />}
          <DashboardCharts />
        </div>
      </div>

      {/* Calendar + Day detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-shrink-0">
        {/* Monthly Calendar */}
        <Card className="lg:col-span-1 p-4 flex flex-col">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold">
              <span>{MONTHS_IT[calMonth]} {calYear}</span>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            <div className="grid grid-cols-7 mb-2">
              {DAYS_IT.map((d, i) => (
                <span key={d} className={`text-center text-[11px] font-medium text-muted-foreground ${i >= 5 ? "opacity-50" : ""}`}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 flex-1">
              {calendarCells.map((day, idx) => {
                const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                const isSelected = day !== null && selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear;
                const isWeekend = idx % 7 >= 5;
                const hasAppointment = day !== null && appointmentDays.has(day);
                return (
                  <button key={idx} disabled={day === null} onClick={() => day !== null && setSelectedDate(new Date(calYear, calMonth, day))}
                    className={`relative flex items-center justify-center w-full aspect-square rounded-lg text-sm transition-colors
                      ${day === null ? "invisible" : ""} ${isSelected ? "bg-primary text-primary-foreground font-bold" : ""}
                      ${isToday && !isSelected ? "bg-primary/15 text-primary font-bold" : ""}
                      ${!isToday && !isSelected && day !== null ? "hover:bg-accent text-foreground/70 font-medium" : ""}
                      ${isWeekend && !isSelected && !isToday ? "opacity-50" : ""}
                    `}>
                    {day}
                    {hasAppointment && (
                      <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected day detail */}
        <Card className="lg:col-span-2 p-4 flex flex-col">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                </div>
                {selectedDate.getDate()} {MONTHS_IT[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </div>
              <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowAppointmentForm(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nuovo
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-y-auto scrollbar-hide">
            {selectedDayAppointments.length > 0 ? (
              <div className="space-y-2">
                {selectedDayAppointments.map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    currentUserId={user?.id}
                    onAccept={(a) => {
                      respondAppointment.mutate({ id: a.id, status: "accepted", created_by: a.created_by });
                      toast.success("Appuntamento accettato");
                    }}
                    onDecline={(a) => setDeclineTarget({ id: a.id, created_by: a.created_by })}
                    onCancel={(a) => {
                      cancelAppointment.mutate({ id: a.id, target_user_id: a.target_user_id });
                      toast.success("Appuntamento annullato");
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nessun appuntamento per questo giorno</p>
                <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => setShowAppointmentForm(true)}>
                  + Aggiungi appuntamento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Timeline - only for admin, not super_admin */}
      {role === "admin" && (
      <Card className="p-4 flex flex-col flex-shrink-0">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <CalendarIcon className="h-4 w-4 text-primary" />
            </div>
            Il mio orario settimanale
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => setWeekOffset((o) => o - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-normal text-muted-foreground min-w-[120px] text-center">
                {weekDates[0].getDate()} – {weekDates[6].getDate()} {MONTHS_IT[weekDates[6].getMonth()]}
              </span>
              <button onClick={() => setWeekOffset((o) => o + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} className="ml-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors px-2 py-0.5 rounded-md bg-primary/10">
                  Oggi
                </button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex mb-1">
            <div className="w-20 shrink-0" />
            <div className="flex-1 flex">
              {TIMELINE_HOURS.map((h) => (
                <div key={h} className="text-[10px] text-muted-foreground font-medium text-center" style={{ width: `${100 / TIMELINE_HOURS.length}%` }}>
                  {String(h).padStart(2, "0")}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {weekDates.map((d, i) => {
              const isDayToday = d.toDateString() === today.toDateString();
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const dayShifts = weekShifts.filter((s) => s.date === dateStr);
              const isDayOff = dayShifts.some((s) => s.is_day_off);
              return (
                <div key={i} className="flex items-center min-h-[28px]">
                  <div className={`w-20 shrink-0 pr-2 text-right text-xs font-medium ${isDayToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    <span className={isDayToday ? "bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-[11px]" : ""}>
                      {DAYS_FULL_IT[i].slice(0, 3)} {d.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 relative h-6 bg-secondary rounded-lg overflow-hidden border border-border">
                    {TIMELINE_HOURS.map((h, hi) => (
                      <div key={h} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: `${(hi / TIMELINE_HOURS.length) * 100}%` }} />
                    ))}
                    {isDayOff ? (
                      <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-destructive">RIPOSO</span>
                      </div>
                    ) : (
                      dayShifts.filter((s) => !s.is_day_off && s.start_time && s.end_time).map((s) => {
                        const sH = parseInt(s.start_time!.split(":")[0]);
                        let eH = parseInt(s.end_time!.split(":")[0]);
                        if (eH === 0) eH = 24;
                        const totalSpan = TIMELINE_HOURS[TIMELINE_HOURS.length - 1] + 1 - TIMELINE_HOURS[0];
                        const left = ((sH - TIMELINE_HOURS[0]) / totalSpan) * 100;
                        const width = ((eH - sH) / totalSpan) * 100;
                        return (
                            (() => {
                              const color = getShiftColor(s);
                              return (
                                <div key={s.id} className={`absolute top-0.5 bottom-0.5 rounded-md ${color.bg} border ${color.border} flex items-center justify-center`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}>
                                  <span className={`text-[10px] font-semibold ${color.text}`}>{s.start_time?.slice(0, 5)}–{formatEndTime(s.end_time)}</span>
                                </div>
                              );
                            })()
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Appointment Form Dialog */}
      <AppointmentFormDialog
        open={showAppointmentForm}
        onOpenChange={setShowAppointmentForm}
        defaultDate={selectedDateStr}
      />

      {/* Decline reason dialog */}
      <AlertDialog open={!!declineTarget} onOpenChange={(open) => { if (!open) { setDeclineTarget(null); setDeclineReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-destructive" />
              Rifiuta appuntamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Scrivi una motivazione per il rifiuto (opzionale). Verrà inviata a chi ha creato l'appuntamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Es. Ho un impegno in quel giorno..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeclineTarget(null); setDeclineReason(""); }}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (declineTarget) {
                  respondAppointment.mutate({
                    id: declineTarget.id,
                    status: "declined",
                    created_by: declineTarget.created_by,
                    decline_reason: declineReason.trim() || undefined,
                  });
                  toast.success("Appuntamento rifiutato");
                  setDeclineTarget(null);
                  setDeclineReason("");
                }
              }}
            >
              Conferma rifiuto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
