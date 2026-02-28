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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const { user, role, activeStore } = useAuth();
  const [showRequestPopup, setShowRequestPopup] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject";
    request: { id: string; name: string; type: string; dates: string };
  } | null>(null);

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

  const pendingRequests = isAdmin
    ? [
        { id: "1", name: "Mario Rossi", type: "Ferie", dates: "10-14 Mar" },
        { id: "2", name: "Giulia Bianchi", type: "Permesso", dates: "12 Mar" },
      ]
    : [];

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
      value: pendingRequests.length,
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

  /* ── Employee-only dashboard ── */
  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col overflow-y-auto gap-5 pb-6 animate-in fade-in duration-500">
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
              <div className="grid grid-cols-7 gap-y-0.5">
                {calendarCells.map((day, idx) => {
                  const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                  const isSelected = day !== null && selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear;
                  const isWeekend = idx % 7 >= 5;
                  return (
                    <button key={idx} disabled={day === null} onClick={() => day !== null && setSelectedDate(new Date(calYear, calMonth, day))}
                      className={`mx-auto flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors
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
  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-hide gap-5 animate-in fade-in duration-500">
      {/* KPI Cards Row */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory flex-shrink-0 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-5 md:overflow-visible">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="min-w-[160px] snap-start md:min-w-0">
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      <DashboardCharts />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-shrink-0">
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
            <div className="grid grid-cols-7 gap-y-0.5">
              {calendarCells.map((day, idx) => {
                const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                const isSelected = day !== null && selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear;
                const isWeekend = idx % 7 >= 5;
                return (
                  <button key={idx} disabled={day === null} onClick={() => day !== null && setSelectedDate(new Date(calYear, calMonth, day))}
                    className={`mx-auto flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors
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

        <Card className="lg:col-span-2 p-4 flex flex-col">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary">
                <Inbox className="h-4 w-4 text-muted-foreground" />
              </div>
              Richieste pendenti
              {pendingRequests.length > 0 && (
                <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-0 font-semibold">{pendingRequests.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {pendingRequests.length > 0 ? (
              <div className="space-y-2">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl bg-secondary p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.type} · {r.dates}</p>
                    </div>
                    <div className="flex gap-1.5 ml-3">
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors" onClick={() => setConfirmAction({ type: "approve", request: r })}>
                        <Check className="h-4 w-4" />
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors" onClick={() => setConfirmAction({ type: "reject", request: r })}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <Link to="/requests" className="inline-block text-xs text-primary hover:text-primary/80 transition-colors mt-1">Vedi tutte le richieste →</Link>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Nessuna richiesta pendente</p>
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
            Agenda Settimanale
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

      {/* Request Popup Modal */}
      <Dialog open={showRequestPopup} onOpenChange={setShowRequestPopup}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuova Richiesta</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Compila il modulo per inviare una nuova richiesta</DialogDescription>
          </DialogHeader>
          {activeStore?.id ? (
            <RequestForm department={department} storeId={activeStore.id} onClose={() => setShowRequestPopup(false)} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Seleziona uno store per inviare una richiesta.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.type === "approve" ? "Approva richiesta" : "Rifiuta richiesta"}</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler {confirmAction?.type === "approve" ? "approvare" : "rifiutare"} la richiesta di <strong>{confirmAction?.request.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.type === "approve" ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"}
              onClick={() => {
                if (!confirmAction) return;
                toast.success(confirmAction.type === "approve" ? `Richiesta di ${confirmAction.request.name} approvata` : `Richiesta di ${confirmAction.request.name} rifiutata`);
                setConfirmAction(null);
              }}
            >
              {confirmAction?.type === "approve" ? "Approva" : "Rifiuta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
