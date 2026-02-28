import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Search, Users, CalendarDays } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getShiftColor, formatEndTime } from "@/lib/shiftColors";
import type { ShiftRow } from "@/hooks/useShifts";

const DAYS_FULL_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const TIMELINE_HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

interface AdminUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
  stores: { id: string; name: string }[];
}

function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users-with-stores"],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (rolesErr) throw rolesErr;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map((r) => r.user_id);

      const [profilesRes, assignmentsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", userIds),
        supabase.from("user_store_assignments").select("user_id, store_id, stores(id, name)").in("user_id", userIds),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      const profileMap = new Map(profilesRes.data?.map((p) => [p.id, p]) ?? []);
      const storesByUser = new Map<string, { id: string; name: string }[]>();
      (assignmentsRes.data ?? []).forEach((a: any) => {
        const arr = storesByUser.get(a.user_id) ?? [];
        if (a.stores) arr.push({ id: a.stores.id, name: a.stores.name });
        storesByUser.set(a.user_id, arr);
      });

      return userIds.map((uid) => {
        const p = profileMap.get(uid);
        return {
          user_id: uid,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          stores: storesByUser.get(uid) ?? [],
        };
      }).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    },
  });
}

const AdminShiftsViewer = () => {
  const { stores } = useAuth();
  const { data: admins = [], isLoading: loadingAdmins } = useAdminUsers();

  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [weekOffset, setWeekOffset] = useState(0);

  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => {
    const base = addWeeks(today, weekOffset);
    return startOfWeek(base, { weekStartsOn: 1 });
  }, [today, weekOffset]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekDates[6], "yyyy-MM-dd");

  const filteredAdmins = useMemo(() => {
    let list = admins;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.full_name?.toLowerCase().includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.stores.some((s) => s.name.toLowerCase().includes(q))
      );
    }
    if (storeFilter !== "all") {
      list = list.filter((a) => a.stores.some((s) => s.id === storeFilter));
    }
    return list;
  }, [admins, searchQuery, storeFilter]);

  const selectedAdmin = admins.find((a) => a.user_id === selectedAdminId) ?? null;

  // Fetch ONLY the selected admin's personal shifts
  const { data: adminShifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ["admin-personal-shifts", selectedAdminId, weekStartStr, weekEndStr],
    queryFn: async () => {
      if (!selectedAdminId) return [];

      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("user_id", selectedAdminId)
        .gte("date", weekStartStr)
        .lte("date", weekEndStr)
        .order("date")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedAdminId,
  });

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, typeof adminShifts>();
    adminShifts.forEach((s) => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [adminShifts]);

  const storeMap = useMemo(
    () => new Map(stores.map((s) => [s.id, s.name])),
    [stores]
  );

  const allAdminStores = useMemo(() => {
    const map = new Map<string, string>();
    admins.forEach((a) => a.stores.forEach((s) => map.set(s.id, s.name)));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [admins]);

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-hide gap-5 pb-6 animate-in fade-in duration-500">
      <PageHeader title="Orari Admin" subtitle="Seleziona un admin per visualizzare il suo orario settimanale personale" />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Left panel: admin list */}
        <Card className="flex flex-col max-h-[calc(100vh-180px)]">
          <CardHeader className="p-4 pb-3 space-y-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <Users className="h-4 w-4 text-primary" />
              </div>
              Admin ({filteredAdmins.length})
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca admin o store..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tutti gli store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli store</SelectItem>
                {allAdminStores.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {loadingAdmins ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </div>
              ) : filteredAdmins.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nessun admin trovato</p>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredAdmins.map((admin) => {
                    const isSelected = admin.user_id === selectedAdminId;
                    return (
                      <button
                        key={admin.user_id}
                        onClick={() => setSelectedAdminId(admin.user_id)}
                        className={`w-full text-left rounded-xl p-3 transition-all ${
                          isSelected
                            ? "bg-primary/15 border border-primary/30"
                            : "hover:bg-accent border border-transparent"
                        }`}
                      >
                        <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {admin.full_name ?? admin.email ?? "—"}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {admin.stores.map((s) => (
                            <Badge key={s.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {s.name}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right panel: personal weekly timeline */}
        <Card className="flex flex-col">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              {selectedAdmin
                ? `Orario — ${selectedAdmin.full_name ?? "Admin"}`
                : "Seleziona un admin"}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => setWeekOffset((o) => o - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-normal text-muted-foreground min-w-[140px] text-center">
                  {format(weekDates[0], "d", { locale: it })} – {format(weekDates[6], "d MMM yyyy", { locale: it })}
                </span>
                <button
                  onClick={() => setWeekOffset((o) => o + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {weekOffset !== 0 && (
                  <button
                    onClick={() => setWeekOffset(0)}
                    className="ml-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors px-2 py-0.5 rounded-md bg-primary/10"
                  >
                    Oggi
                  </button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex-1">
            {!selectedAdmin ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Users className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Seleziona un admin dalla lista per visualizzare il suo orario</p>
              </div>
            ) : loadingShifts ? (
              <div className="space-y-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {/* Timeline header */}
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

                {/* Timeline rows */}
                <div className="space-y-1">
                  {weekDates.map((d, i) => {
                    const isDayToday = d.toDateString() === today.toDateString();
                    const dateStr = format(d, "yyyy-MM-dd");
                    const dayShifts = shiftsByDate.get(dateStr) ?? [];
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
                          ) : dayShifts.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[9px] text-muted-foreground/50">Nessun turno</span>
                            </div>
                          ) : (
                            dayShifts.filter((s) => !s.is_day_off && s.start_time && s.end_time).map((s) => {
                              const sH = parseInt(s.start_time!.split(":")[0]);
                              let eH = parseInt(s.end_time!.split(":")[0]);
                              if (eH === 0) eH = 24;
                              const totalSpan = TIMELINE_HOURS[TIMELINE_HOURS.length - 1] + 1 - TIMELINE_HOURS[0];
                              const left = ((sH - TIMELINE_HOURS[0]) / totalSpan) * 100;
                              const width = ((eH - sH) / totalSpan) * 100;
                              const color = getShiftColor(s as ShiftRow);
                              const storeName = storeMap.get(s.store_id) ?? "";

                              return (
                                <div
                                  key={s.id}
                                  className={`absolute top-0.5 bottom-0.5 rounded-md ${color.bg} border ${color.border} flex items-center justify-center gap-1`}
                                  style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}
                                >
                                  <span className={`text-[10px] font-semibold ${color.text}`}>
                                    {s.start_time?.slice(0, 5)}–{formatEndTime(s.end_time)}
                                  </span>
                                  {storeName && (
                                    <span className={`text-[8px] font-medium ${color.text} opacity-70 truncate`}>
                                      {storeName}
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weekly summary */}
                {adminShifts.length > 0 && (
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                      {adminShifts.filter(s => !s.is_day_off).length} turni
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                      {adminShifts.filter(s => s.is_day_off).length} riposi
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                      {(() => {
                        let total = 0;
                        adminShifts.forEach(s => {
                          if (!s.is_day_off && s.start_time && s.end_time) {
                            const sH = parseInt(s.start_time.split(":")[0]);
                            let eH = parseInt(s.end_time.split(":")[0]);
                            if (eH === 0) eH = 24;
                            total += eH - sH;
                          }
                        });
                        return `${total}h totali`;
                      })()}
                    </Badge>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminShiftsViewer;
