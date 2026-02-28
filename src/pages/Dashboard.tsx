import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Users,
  Clock,
  AlertTriangle,
  Inbox,
  TrendingUp,
  TrendingDown,
  Bell,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useAppointments, useRespondAppointment } from "@/hooks/useAppointments";
import { AppointmentFormDialog } from "@/components/dashboard/AppointmentFormDialog";

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
  const calendarCells = useMemo(() => buildCalendarGrid(calYear, calMonth), [calYear, calMonth]);
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

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

  /* ── KPI data (placeholder – will be wired to real queries) ── */
  const kpis: KpiCardProps[] = [
    {
      title: "Dipendenti attivi",
      value: 24,
      trend: 4.5,
      period: "vs mese scorso",
      icon: <Users className="h-4 w-4" />,
    },
    {
      title: "Ore settimanali",
      value: "312h",
      trend: -2.1,
      period: "vs sett. scorsa",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      title: "Turni scoperti",
      value: 3,
      trend: -25,
      period: "vs sett. scorsa",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    {
      title: "Richieste pendenti",
      value: 0,
      trend: 0,
      period: "questa settimana",
      icon: <Inbox className="h-4 w-4" />,
    },
    {
      title: "Tasso copertura",
      value: "94%",
      trend: 1.8,
      period: "vs sett. scorsa",
      icon: <TrendingUp className="h-4 w-4" />,
    },
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

  /* ── Employee-only dashboard ── */
  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col overflow-y-auto scrollbar-hide gap-5 pb-6 animate-in fade-in duration-500">
        {/* Weekly Timeline */}
        <Card className="p-4 flex flex-col flex-shrink-0">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              Il mio orario settimanale
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {weekDates[0].getDate()} – {weekDates[6].getDate()} {MONTHS_IT[weekDates[0].getMonth()]}
              </span>
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
                            <div key={s.id} className="absolute top-0.5 bottom-0.5 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center" style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}>
                              <span className="text-[10px] font-semibold text-primary">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</span>
                            </div>
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

        {/* Request + Calendar side by side on desktop, stacked on mobile */}
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
      </div>
    );
  }

  /* ── Admin/Super Admin dashboard ── */
  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
  const selectedDayAppointments = appointments.filter((a) => a.appointment_date === selectedDateStr);


  const CATEGORY_LABELS: Record<string, string> = {
    meeting: "Riunione",
    training: "Formazione",
    inspection: "Ispezione",
    event: "Evento",
    other: "Altro",
  };

  const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    pending: { label: "In attesa", className: "bg-amber-500/15 text-amber-600" },
    accepted: { label: "Accettato", className: "bg-primary/15 text-primary" },
    declined: { label: "Rifiutato", className: "bg-destructive/15 text-destructive" },
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-hide gap-5 pb-6 animate-in fade-in duration-500">
      {/* KPI Cards Row */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory flex-shrink-0 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-5 md:overflow-visible">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="min-w-[160px] snap-start md:min-w-0">
            <KpiCard {...kpi} />
          </div>
        ))}
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
                {selectedDayAppointments.map((apt) => {
                  const statusInfo = STATUS_LABELS[apt.status] ?? STATUS_LABELS.pending;
                  return (
                    <div key={apt.id} className="rounded-xl bg-secondary p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{apt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {apt.start_time?.slice(0, 5)} – {apt.end_time?.slice(0, 5)}
                            {apt.store?.name && <> · {apt.store.name}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge className={`text-[10px] px-1.5 py-0 border-0 font-semibold ${statusInfo.className}`}>
                            {statusInfo.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {CATEGORY_LABELS[apt.category] ?? apt.category}
                          </Badge>
                        </div>
                      </div>
                      {apt.target_profile?.full_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> Con: {apt.target_profile.full_name}
                        </p>
                      )}
                      {apt.description && <p className="text-xs text-foreground/70">{apt.description}</p>}
                      {apt.notes && <p className="text-xs text-muted-foreground italic">Note: {apt.notes}</p>}
                      {/* Accept/Decline for target user viewing own appointments */}
                      {apt.status === "pending" && apt.target_user_id === user?.id && (
                        <div className="flex gap-1.5 pt-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs bg-primary/15 text-primary hover:bg-primary/25"
                            onClick={() => {
                              respondAppointment.mutate({ id: apt.id, status: "accepted", created_by: apt.created_by });
                              toast.success("Appuntamento accettato");
                            }}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Accetta
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs bg-destructive/15 text-destructive hover:bg-destructive/25"
                            onClick={() => {
                              respondAppointment.mutate({ id: apt.id, status: "declined", created_by: apt.created_by });
                              toast.success("Appuntamento rifiutato");
                            }}>
                            <X className="h-3.5 w-3.5 mr-1" /> Rifiuta
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
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

      {/* Weekly Timeline */}
      <Card className="p-4 flex flex-col flex-shrink-0">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <CalendarIcon className="h-4 w-4 text-primary" />
            </div>
            Il mio orario settimanale
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {weekDates[0].getDate()} – {weekDates[6].getDate()} {MONTHS_IT[weekDates[0].getMonth()]}
            </span>
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
                          <div key={s.id} className="absolute top-0.5 bottom-0.5 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center" style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}>
                            <span className="text-[10px] font-semibold text-primary">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</span>
                          </div>
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

      {/* Appointment Form Dialog */}
      <AppointmentFormDialog
        open={showAppointmentForm}
        onOpenChange={setShowAppointmentForm}
        defaultDate={selectedDateStr}
      />
    </div>
  );
};

export default Dashboard;
