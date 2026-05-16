import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Check, X, Users, Clock, Inbox, TrendingUp, TrendingDown,
  Bell, Plus, MessageSquare, Globe, Store,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import RequestForm from "@/components/requests/RequestForm";
import { EmployeeOnboardingModal } from "@/components/employees/EmployeeOnboardingModal";
import { useQuery } from "@tanstack/react-query";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { TeamHoursCard } from "@/components/dashboard/TeamHoursCard";
import { VacationBalanceCard } from "@/components/dashboard/VacationBalanceCard";
import { QualityScoreCard } from "@/components/dashboard/QualityScoreCard";
import { useAppointments, useRespondAppointment, useCancelAppointment } from "@/hooks/useAppointments";
import { AppointmentFormDialog } from "@/components/dashboard/AppointmentFormDialog";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { getShiftColor, formatEndTime } from "@/lib/shiftColors";

/* ── helpers ─────────────────────────────────────────── */

const DAYS_FULL_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const DAYS_IT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

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

/* ── KPI card ─────────────────────────────────────────── */

interface KpiCardProps {
  title: string;
  value: string | number;
  trend: number;
  period: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
}

function KpiCard({ title, value, trend, period, icon, gradient, iconBg }: KpiCardProps) {
  const isPositive = trend >= 0;
  return (
    <div className={`rounded-2xl p-5 text-white relative overflow-hidden shadow-card-hover transition-all duration-200 hover:-translate-y-1 ${gradient}`}>
      {/* Decorative circle */}
      <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -right-2 h-28 w-28 rounded-full bg-white/5" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <p className="text-[13px] font-semibold text-white/80">{title}</p>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
            <div className="[&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-white">{icon}</div>
          </div>
        </div>
        <p className="text-3xl font-black text-white leading-none">{value}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${isPositive ? "bg-white/20" : "bg-black/20"}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{trend}%
          </div>
          <span className="text-[11px] text-white/60">{period}</span>
        </div>
      </div>
    </div>
  );
}

/* ── SectionCard helper ─────────────────────────────── */

function SectionCard({ title, icon, iconColor, iconBg, children, action }: {
  title: string;
  icon: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="flex items-center justify-between text-[14px] font-bold text-slate-900">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg ?? "bg-sky-50"}`}>
              <div className={`[&>svg]:h-4 [&>svg]:w-4 ${iconColor ?? "text-sky-600"}`}>{icon}</div>
            </div>
            {title}
          </div>
          {action}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

/* ── Mini calendar ───────────────────────────────────── */

function MiniCalendar({ calYear, calMonth, calendarCells, today, selectedDate, setSelectedDate, prevMonth, nextMonth, appointmentDays }: any) {
  return (
    <Card className="p-5">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="flex items-center justify-between text-[14px] font-bold text-slate-900">
          <span>{MONTHS_IT[calMonth]} {calYear}</span>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <div className="grid grid-cols-7 mb-2">
          {DAYS_IT.map((d, i) => (
            <span key={d} className={`text-center text-[10px] font-bold text-slate-500 uppercase tracking-wide ${i >= 5 ? "opacity-40" : ""}`}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {calendarCells.map((day: number | null, idx: number) => {
            const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
            const isSelected = day !== null && selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear;
            const isWeekend = idx % 7 >= 5;
            const hasAppointment = day !== null && appointmentDays?.has(day);
            return (
              <button key={idx} disabled={day === null} onClick={() => day !== null && setSelectedDate(new Date(calYear, calMonth, day))}
                className={`relative flex items-center justify-center w-full aspect-square rounded-lg text-[13px] font-medium transition-all duration-150
                  ${day === null ? "invisible" : ""}
                  ${isSelected ? "bg-gradient-to-br from-sky-600 to-sky-700 text-white font-bold" : ""}
                  ${isToday && !isSelected ? "bg-sky-50 text-sky-600 font-bold ring-1 ring-sky-500/40" : ""}
                  ${!isToday && !isSelected && day !== null ? "hover:bg-slate-100 text-slate-900" : ""}
                  ${isWeekend && !isSelected && !isToday ? "text-slate-400" : ""}
                `}>
                {day}
                {hasAppointment && (
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-sky-600"}`} />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Timeline row ────────────────────────────────────── */

function WeekTimeline({ weekDates, today, weekShifts }: { weekDates: Date[]; today: Date; weekShifts: any[] }) {
  return (
    <div>
      <div className="flex mb-2">
        <div className="w-20 shrink-0" />
        <div className="flex-1 flex">
          {TIMELINE_HOURS.map((h) => (
            <div key={h} className="text-[9px] text-slate-400 font-mono text-center" style={{ width: `${100 / TIMELINE_HOURS.length}%` }}>
              {String(h).padStart(2, "0")}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {weekDates.map((d, i) => {
          const isDayToday = d.toDateString() === today.toDateString();
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const dayShifts = weekShifts.filter((s) => s.date === dateStr);
          const isDayOff = dayShifts.some((s) => s.is_day_off);
          const isWeekend = i >= 5;
          return (
            <div key={i} className="flex items-center min-h-[30px]">
              <div className={`w-20 shrink-0 pr-2 text-right text-[11px] font-semibold ${isDayToday ? "text-sky-600" : isWeekend ? "text-slate-400" : "text-slate-500"}`}>
                <span className={isDayToday ? "bg-gradient-to-r from-sky-600 to-sky-700 text-white rounded-md px-2 py-0.5 text-[10px]" : ""}>
                  {DAYS_FULL_IT[i].slice(0, 3)} {d.getDate()}
                </span>
              </div>
              <div className={`flex-1 relative h-7 rounded-lg overflow-hidden border transition-colors ${isDayToday ? "bg-sky-50 border-sky-400/20" : "bg-[#f8f9fc] border-slate-200"}`}>
                {TIMELINE_HOURS.map((h, hi) => (
                  <div key={h} className="absolute top-0 bottom-0 border-l border-slate-200/60" style={{ left: `${(hi / TIMELINE_HOURS.length) * 100}%` }} />
                ))}
                {isDayOff ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#ef4444] tracking-wider">RIPOSO</span>
                  </div>
                ) : (
                  dayShifts.filter((s) => !s.is_day_off && s.start_time && s.end_time).map((s) => {
                    const sH = parseInt(s.start_time!.split(":")[0]);
                    let eH = parseInt(s.end_time!.split(":")[0]);
                    if (eH === 0) eH = 24;
                    const totalSpan = TIMELINE_HOURS[TIMELINE_HOURS.length - 1] + 1 - TIMELINE_HOURS[0];
                    const left = ((sH - TIMELINE_HOURS[0]) / totalSpan) * 100;
                    const width = ((eH - sH) / totalSpan) * 100;
                    const color = getShiftColor(s);
                    return (
                      <div key={s.id} className={`absolute top-1 bottom-1 rounded-md ${color.bg} border ${color.border} flex items-center justify-center`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}>
                        <span className={`text-[9px] font-bold ${color.text} font-mono`}>{s.start_time?.slice(0, 5)}–{formatEndTime(s.end_time)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── component ───────────────────────────────────────── */

const Dashboard = () => {
  const { user, role, activeStore, stores } = useAuth();
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<{ id: string; created_by: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [viewAllStores, setViewAllStores] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const isSuperAdmin = role === "super_admin";

  const { data: myDetails } = useQuery({
    queryKey: ["my-employee-details", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_details").select("department").eq("user_id", user!.id).maybeSingle();
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
  const weekBaseDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + weekOffset * 7); return d; }, [today, weekOffset]);
  const weekDates = useMemo(() => getWeekDates(weekBaseDate), [weekBaseDate]);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); };

  const isAdmin = role === "admin" || role === "super_admin" || role === "store_manager";

  const { data: appointments = [] } = useAppointments(calMonth, calYear);
  const respondAppointment = useRespondAppointment();
  const cancelAppointment = useCancelAppointment();

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const weekStartStr = fmt(weekStart);
  const weekEndStr = fmt(weekEnd);

  const { data: weekShifts = [] } = useQuery({
    queryKey: ["my-week-shifts", user?.id, weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").eq("user_id", user!.id).gte("date", weekStartStr).lte("date", weekEndStr).order("date").order("start_time");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const { data: activeEmployeeCount = 0 } = useQuery({
    queryKey: ["kpi-active-employees", activeStore?.id],
    queryFn: async () => {
      const { count, error } = await supabase.from("user_store_assignments").select("*", { count: "exact", head: true }).eq("store_id", activeStore!.id);
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
    return fmt(mon);
  }, []);
  const thisWeekEnd = useMemo(() => {
    const d = new Date(thisWeekStart);
    d.setDate(d.getDate() + 6);
    return fmt(d);
  }, [thisWeekStart]);

  const { data: weeklyTeamHours = 0 } = useQuery({
    queryKey: ["kpi-weekly-hours", activeStore?.id, thisWeekStart],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("start_time, end_time").eq("store_id", activeStore!.id).eq("is_day_off", false).gte("date", thisWeekStart).lte("date", thisWeekEnd);
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
      const { count, error } = await supabase.from("time_off_requests").select("*", { count: "exact", head: true }).eq("store_id", activeStore!.id).eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!activeStore?.id && !isSuperAdmin,
  });

  const kpiConfig = [
    {
      title: "Dipendenti attivi",
      value: activeEmployeeCount,
      trend: 0,
      period: "store attuale",
      icon: <Users />,
      gradient: "bg-gradient-to-br from-sky-600 to-sky-700",
      iconBg: "bg-white/20",
    },
    {
      title: "Ore settimana",
      value: `${weeklyTeamHours}h`,
      trend: 0,
      period: "settimana corrente",
      icon: <Clock />,
      gradient: "bg-gradient-to-br from-[#10b981] to-[#059669]",
      iconBg: "bg-white/20",
    },
    ...(!isSuperAdmin ? [{
      title: "Richieste pendenti",
      value: pendingRequestsCount,
      trend: 0,
      period: "in attesa",
      icon: <Inbox />,
      gradient: "bg-gradient-to-br from-[#f59e0b] to-[#d97706]",
      iconBg: "bg-white/20",
    }] : []),
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

  const employeeAppointmentDateStr = fmt(selectedDate);
  const employeeSelectedDayAppointments = appointments.filter((a) => a.appointment_date === employeeAppointmentDateStr);

  const DeclineDialog = () => (
    <AlertDialog open={!!declineTarget} onOpenChange={(open) => { if (!open) { setDeclineTarget(null); setDeclineReason(""); } }}>
      <AlertDialogContent className="rounded-2xl border-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#ef4444]" />Rifiuta appuntamento
          </AlertDialogTitle>
          <AlertDialogDescription>Scrivi una motivazione per il rifiuto (opzionale).</AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea placeholder="Es. Ho un impegno in quel giorno..." value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={3} maxLength={500} className="rounded-xl border-slate-200 focus-visible:ring-sky-500/20" />
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-[10px]" onClick={() => { setDeclineTarget(null); setDeclineReason(""); }}>Annulla</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-[10px] bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white"
            onClick={() => {
              if (declineTarget) {
                respondAppointment.mutate({ id: declineTarget.id, status: "declined", created_by: declineTarget.created_by, decline_reason: declineReason.trim() || undefined });
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
  );

  /* ── Employee-only dashboard ── */
  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col overflow-y-auto scrollbar-hide gap-5 pb-6 animate-fade-up">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-shrink-0">
          <VacationBalanceCard />
          {activeStore?.id && (
            <button
              onClick={() => setShowOnboarding(true)}
              className="flex flex-col gap-2 w-full rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 text-left hover:border-sky-400/40 hover:bg-sky-50 transition-all duration-200 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 group-hover:bg-sky-600/20 transition-colors">
                <CalendarIcon className="h-4 w-4 text-sky-600" />
              </div>
              <span className="text-sm font-bold text-slate-900">Le mie preferenze turni</span>
              <span className="text-xs text-slate-500">Tipo turno, giorni liberi, weekend →</span>
            </button>
          )}
        </div>
        {activeStore?.id && (
          <EmployeeOnboardingModal open={showOnboarding} onOpenChange={setShowOnboarding} storeId={activeStore.id} />
        )}

        <SectionCard
          title="Il mio orario settimanale"
          icon={<CalendarIcon />}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          action={
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset((o) => o - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-xs font-semibold text-slate-500 min-w-[110px] text-center font-mono">
                {weekDates[0].getDate()} – {weekDates[6].getDate()} {MONTHS_IT[weekDates[6].getMonth()]}
              </span>
              <button onClick={() => setWeekOffset((o) => o + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500"><ChevronRight className="h-4 w-4" /></button>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} className="ml-1 text-[10px] font-bold text-sky-600 bg-sky-50 rounded-lg px-2 py-1 hover:bg-sky-100 transition-colors">Oggi</button>
              )}
            </div>
          }
        >
          <WeekTimeline weekDates={weekDates} today={today} weekShifts={weekShifts} />
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0">
          <SectionCard title="Nuova Richiesta" icon={<Inbox />} iconBg="bg-[#fef3c7]" iconColor="text-[#d97706]">
            {activeStore?.id ? (
              <RequestForm department={department} storeId={activeStore.id} onClose={() => {}} />
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">Nessuno store assegnato.</p>
            )}
          </SectionCard>
          <MiniCalendar calYear={calYear} calMonth={calMonth} calendarCells={calendarCells} today={today} selectedDate={selectedDate} setSelectedDate={setSelectedDate} prevMonth={prevMonth} nextMonth={nextMonth} />
        </div>

        <SectionCard
          title={`I miei appuntamenti — ${selectedDate.getDate()} ${MONTHS_IT[selectedDate.getMonth()]}`}
          icon={<Bell />}
          iconBg="bg-[#d1fae5]"
          iconColor="text-[#10b981]"
        >
          {employeeSelectedDayAppointments.length > 0 ? (
            <div className="space-y-2">
              {employeeSelectedDayAppointments.map((apt) => (
                <AppointmentCard key={apt.id} appointment={apt} currentUserId={user?.id}
                  onAccept={(a) => { respondAppointment.mutate({ id: a.id, status: "accepted", created_by: a.created_by }); toast.success("Appuntamento accettato"); }}
                  onDecline={(a) => setDeclineTarget({ id: a.id, created_by: a.created_by })}
                  onCancel={(a) => { cancelAppointment.mutate({ id: a.id, target_user_id: a.target_user_id }); toast.success("Appuntamento annullato"); }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 mb-3">
                <CalendarIcon className="h-6 w-6 text-sky-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Nessun appuntamento</p>
              <p className="text-xs text-slate-500 mt-1">Seleziona un giorno nel calendario</p>
            </div>
          )}
        </SectionCard>

        <DeclineDialog />
      </div>
    );
  }

  /* ── Admin/Manager dashboard ── */
  const selectedDateStr = fmt(selectedDate);
  const selectedDayAppointments = appointments.filter((a) => a.appointment_date === selectedDateStr);

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-hide gap-5 pb-6 animate-fade-up">

      {/* Super admin store toggle */}
      {isSuperAdmin && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50">
              <Store className="h-4 w-4 text-sky-600" />
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {viewAllStores ? "Tutti i locali" : (activeStore?.name ?? "Store selezionato")}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Label htmlFor="view-toggle" className="text-xs font-medium text-slate-500">Tutti i locali</Label>
            <Switch id="view-toggle" checked={viewAllStores} onCheckedChange={setViewAllStores} />
            <Globe className={`h-4 w-4 transition-colors ${viewAllStores ? "text-sky-600" : "text-[#c4c9d4]"}`} />
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className={`grid gap-4 flex-shrink-0 ${isSuperAdmin ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {kpiConfig.map((kpi) => <KpiCard key={kpi.title} {...kpi} />)}
      </div>

      {/* Team Hours + Vacation + Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-shrink-0">
        <div className="lg:col-span-2">
          <TeamHoursCard />
        </div>
        <div className="flex flex-col gap-4">
          {(role === "admin" || role === "store_manager") && <VacationBalanceCard />}
          {(role === "admin" || role === "store_manager") && <QualityScoreCard />}
          <DashboardCharts />
        </div>
      </div>

      {/* Calendar + Day detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-shrink-0">
        <MiniCalendar calYear={calYear} calMonth={calMonth} calendarCells={calendarCells} today={today} selectedDate={selectedDate} setSelectedDate={setSelectedDate} prevMonth={prevMonth} nextMonth={nextMonth} appointmentDays={appointmentDays} />

        <Card className="lg:col-span-2 p-5">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="flex items-center justify-between text-[14px] font-bold text-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50">
                  <CalendarIcon className="h-4 w-4 text-sky-600" />
                </div>
                {selectedDate.getDate()} {MONTHS_IT[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </div>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowAppointmentForm(true)}>
                <Plus className="h-3.5 w-3.5" />Nuovo
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-y-auto scrollbar-hide">
            {selectedDayAppointments.length > 0 ? (
              <div className="space-y-2">
                {selectedDayAppointments.map((apt) => (
                  <AppointmentCard key={apt.id} appointment={apt} currentUserId={user?.id}
                    onAccept={(a) => { respondAppointment.mutate({ id: a.id, status: "accepted", created_by: a.created_by }); toast.success("Appuntamento accettato"); }}
                    onDecline={(a) => setDeclineTarget({ id: a.id, created_by: a.created_by })}
                    onCancel={(a) => { cancelAppointment.mutate({ id: a.id, target_user_id: a.target_user_id }); toast.success("Appuntamento annullato"); }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 mb-3">
                  <CalendarIcon className="h-7 w-7 text-sky-600" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Nessun appuntamento</p>
                <Button variant="ghost" size="sm" className="mt-2 text-xs text-sky-600" onClick={() => setShowAppointmentForm(true)}>
                  + Aggiungi appuntamento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Timeline — admin/manager only */}
      {(role === "admin" || role === "store_manager") && (
        <SectionCard
          title="Il mio orario settimanale"
          icon={<CalendarIcon />}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          action={
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset((o) => o - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-xs font-semibold text-slate-500 min-w-[110px] text-center font-mono">
                {weekDates[0].getDate()} – {weekDates[6].getDate()} {MONTHS_IT[weekDates[6].getMonth()]}
              </span>
              <button onClick={() => setWeekOffset((o) => o + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500"><ChevronRight className="h-4 w-4" /></button>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} className="ml-1 text-[10px] font-bold text-sky-600 bg-sky-50 rounded-lg px-2 py-1 hover:bg-sky-100 transition-colors">Oggi</button>
              )}
            </div>
          }
        >
          <WeekTimeline weekDates={weekDates} today={today} weekShifts={weekShifts} />
        </SectionCard>
      )}

      <AppointmentFormDialog open={showAppointmentForm} onOpenChange={setShowAppointmentForm} defaultDate={selectedDateStr} />
      <DeclineDialog />
    </div>
  );
};

export default Dashboard;
