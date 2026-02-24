import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Palmtree,
  Bell,
  Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useNavigate, Link } from "react-router-dom";
import RequestForm from "@/components/requests/RequestForm";
import { useQuery } from "@tanstack/react-query";

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

const TIMELINE_HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07–23

/* ── card style ──────────────────────────────────────── */

const cardBase = "glass-card rounded-[20px] p-4";

const cardProfile = cardBase;
const cardFerie = cardBase;
const cardCalendar = cardBase;
const cardRichiesteAdmin = cardBase;
const cardRichiesteUser = cardBase;
const cardAgenda = "glass-card rounded-[20px] p-3";

/* ── component ───────────────────────────────────────── */

const Dashboard = () => {
  const { user, role, activeStore } = useAuth();
  const navigate = useNavigate();
  const [showRequestPopup, setShowRequestPopup] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject";
    request: { id: string; name: string; type: string; dates: string };
  } | null>(null);

  /* employee department for request form */
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

  /* calendar state */
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

  /* user info */
  const displayName = user?.user_metadata?.full_name || user?.email || "Utente";
  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url;
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
    admin: "Admin",
    employee: "Dipendente",
  };

  const remainingVacation = 14;

  const isAdmin = role === "admin" || role === "super_admin";

  /* pending requests (placeholder) */
  const pendingRequests = isAdmin
    ? [
        { id: "1", name: "Mario Rossi", type: "Ferie", dates: "10-14 Mar" },
        { id: "2", name: "Giulia Bianchi", type: "Permesso", dates: "12 Mar" },
      ]
    : [];

  /* agenda: fetch user shifts for the selected week */
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

  /* dynamic subtitle */
  const subtitle = isAdmin && pendingRequests.length > 0
    ? `Hai ${pendingRequests.length} richieste in attesa e ${remainingVacation} giorni di ferie disponibili`
    : !isAdmin
      ? `Hai ${remainingVacation} giorni di ferie disponibili`
      : "Panoramica generale di tutti gli store e del team";

  return (
    <div className="flex h-full flex-col overflow-hidden animate-in fade-in duration-500">
      {/* Header – greeting */}
      <div className="mb-1 flex-shrink-0">
        <h1 className="text-base font-bold tracking-tight text-foreground">
          Benvenuto {displayName} 👋
        </h1>
        <p className="text-[10px] text-muted-foreground">
          {subtitle}
        </p>
      </div>

      {/* Quadrant Grid – fills viewport, no scroll */}
      <div
        className="flex-1 gap-2.5 min-h-0 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto 1fr',
          gridTemplateRows: 'auto auto minmax(0, 1fr)',
          gridTemplateAreas: `
            "profile requests calendar"
            "vacation requests calendar"
            "agenda agenda agenda"
          `,
        }}
      >

        {/* ── Profile Card (top-left, compact) ── */}
        <Card className={`${cardProfile} flex flex-col items-center justify-center`} style={{ gridArea: 'profile' }}>
          <Avatar className="h-8 w-8 shadow-md">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <p className="mt-1 text-[11px] font-bold text-foreground truncate">{displayName}</p>
          {role && (
            <Badge className="mt-1 text-[9px] px-1.5 py-0 bg-foreground/10 text-foreground/70 border border-foreground/20 hover:bg-foreground/15">
              {roleLabelMap[role] || role}
            </Badge>
          )}
        </Card>

        {/* ── Vacation Card (below profile, compact) ── */}
        <Card className={`${cardFerie} flex flex-col items-center justify-center`} style={{ gridArea: 'vacation' }}>
          <div className="relative flex h-11 w-11 items-center justify-center">
            <svg className="h-11 w-11 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="27" fill="none" stroke="currentColor"
                className="text-foreground"
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(remainingVacation / 26) * 169.6} 169.6`}
              />
            </svg>
            <span className="absolute text-sm font-bold text-foreground">{remainingVacation}</span>
          </div>
        </Card>

        {/* ── Requests Card (center, vertical, spans 2 rows) ── */}
        <Card className={`${isAdmin ? cardRichiesteAdmin : cardRichiesteUser} flex flex-col overflow-hidden`} style={{ gridArea: 'requests' }}>
          <div className="flex items-center gap-1 mb-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-accent">
              {isAdmin ? (
                <Inbox className="h-3 w-3 text-muted-foreground" />
              ) : (
                <Bell className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <p className="text-[10px] font-bold text-foreground">{isAdmin ? "Richieste" : "Avvisi"}</p>
          </div>
          {isAdmin && pendingRequests.length > 0 ? (
            <div className="flex-1 space-y-1 overflow-auto scrollbar-hide">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground text-background text-[9px] font-bold px-1">
                  {pendingRequests.length}
                </span>
                <span className="text-[10px] text-muted-foreground">richieste in attesa</span>
              </div>
              {pendingRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-[10px]">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{r.name}</span>
                    <span className="ml-1 text-muted-foreground text-[9px]">· {r.type}</span>
                  </div>
                  <div className="flex gap-0.5 ml-1.5">
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-foreground hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Approva richiesta di ${r.name}`}
                      onClick={() => setConfirmAction({ type: "approve", request: r })}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Rifiuta richiesta di ${r.name}`}
                      onClick={() => setConfirmAction({ type: "reject", request: r })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="pt-0.5">
                <Link
                  to="/requests"
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Vedi tutte →
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[10px] text-muted-foreground">Nessuna richiesta pendente</p>
            </div>
          )}
        </Card>

        {/* ── Calendar Card (right quadrant, spans 2 rows) ── */}
        <Card className={`${cardCalendar} flex flex-col overflow-hidden`} style={{ gridArea: 'calendar' }}>
          <CardHeader className="p-0 pb-1">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-foreground tracking-wide">
              <span className="font-bold">{MONTHS_IT[calMonth]} {calYear}</span>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent transition-colors" aria-label="Mese precedente">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button onClick={nextMonth} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent transition-colors" aria-label="Mese successivo">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            <div className="grid grid-cols-7 mb-1">
              {DAYS_IT.map((d, i) => (
                <span key={d} className={`text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground ${i >= 5 ? "opacity-50" : ""}`}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 content-stretch">
              {calendarCells.map((day, idx) => {
                const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                const isSelected = day !== null && selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear;
                const isWeekend = idx % 7 >= 5;
                return (
                  <button
                    key={idx}
                    disabled={day === null}
                    onClick={() => day !== null && setSelectedDate(new Date(calYear, calMonth, day))}
                    className={`mx-auto flex flex-col items-center justify-center w-full aspect-square max-h-10 rounded-full text-sm transition-colors
                      ${day === null ? "invisible" : ""}
                      ${isSelected ? "bg-primary text-primary-foreground font-bold" : ""}
                      ${isToday && !isSelected ? "bg-primary/10 text-foreground font-bold" : ""}
                      ${!isToday && !isSelected && day !== null ? "hover:bg-muted font-medium text-foreground/70" : ""}
                      ${isWeekend && !isSelected && !isToday ? "opacity-50" : ""}
                    `}
                  >
                    {day}
                    {isToday && day !== null && (
                      <span className="block h-1 w-1 rounded-full bg-foreground -mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Weekly Timeline Card (full width, like DayDetail) ── */}
        <Card className={`${cardAgenda} flex flex-col min-h-0 overflow-hidden`} style={{ gridArea: 'agenda' }}>
          <CardHeader className="p-0 pb-1 flex-shrink-0">
            <CardTitle className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
              <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-primary/10">
                <CalendarIcon className="h-2.5 w-2.5 text-primary" />
              </div>
              Agenda Settimanale
              <span className="ml-auto text-[9px] font-normal text-muted-foreground">
                {weekDates[0].getDate()} – {weekDates[6].getDate()} {MONTHS_IT[weekDates[0].getMonth()]}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
            {/* Timeline header row */}
            <div className="flex mb-0.5">
              <div className="w-20 shrink-0" />
              <div className="flex-1 flex">
                {TIMELINE_HOURS.map((h) => (
                  <div
                    key={h}
                    className="text-[9px] text-muted-foreground font-medium text-center"
                    style={{ width: `${100 / TIMELINE_HOURS.length}%` }}
                  >
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
              </div>
            </div>

            {/* Day rows */}
            <div className="space-y-0.5 flex-1">
              {weekDates.map((d, i) => {
                const isDayToday = d.toDateString() === today.toDateString();
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                const dayShifts = weekShifts.filter((s) => s.date === dateStr);
                const isDayOff = dayShifts.some((s) => s.is_day_off);

                return (
                  <div key={i} className="flex items-center min-h-[22px]">
                    {/* Day label */}
                    <div className={`w-20 shrink-0 pr-2 text-right text-[10px] font-medium ${isDayToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      <span className={isDayToday ? "bg-primary text-primary-foreground rounded-full px-1.5 py-0.5" : ""}>
                        {DAYS_FULL_IT[i].slice(0, 3)} {d.getDate()}
                      </span>
                    </div>

                    {/* Timeline bar */}
                    <div className="flex-1 relative h-5 bg-muted/30 rounded-md overflow-hidden border border-border/40">
                      {/* Hour grid lines */}
                      {TIMELINE_HOURS.map((h, hi) => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-l border-border/20"
                          style={{ left: `${(hi / TIMELINE_HOURS.length) * 100}%` }}
                        />
                      ))}

                      {isDayOff ? (
                        <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center">
                          <span className="text-[9px] font-semibold text-destructive">RIPOSO</span>
                        </div>
                      ) : (
                        dayShifts
                          .filter((s) => !s.is_day_off && s.start_time && s.end_time)
                          .map((s) => {
                            const sH = parseInt(s.start_time!.split(":")[0]);
                            let eH = parseInt(s.end_time!.split(":")[0]);
                            if (eH === 0) eH = 24;
                            const totalSpan = TIMELINE_HOURS[TIMELINE_HOURS.length - 1] + 1 - TIMELINE_HOURS[0];
                            const left = ((sH - TIMELINE_HOURS[0]) / totalSpan) * 100;
                            const width = ((eH - sH) / totalSpan) * 100;

                            const startH = sH;
                            let bg = "bg-muted"; let border = "border-border";
                            if (startH === 9) { bg = "bg-blue-500/20"; border = "border-blue-500/40"; }
                            else if (startH === 11) { bg = "bg-orange-500/20"; border = "border-orange-500/40"; }
                            else if (startH === 19) { bg = "bg-yellow-500/20"; border = "border-yellow-500/40"; }
                            else if (eH === 17 || eH === 19) { bg = "bg-emerald-500/20"; border = "border-emerald-500/40"; }

                            return (
                              <div
                                key={s.id}
                                className={`absolute top-0.5 bottom-0.5 rounded border flex items-center justify-center ${bg} ${border}`}
                                style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}
                              >
                                <span className="text-[9px] font-semibold text-foreground/80">
                                  {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                                </span>
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
      </div>

      {/* Request Popup Modal */}
      <Dialog open={showRequestPopup} onOpenChange={setShowRequestPopup}>
        <DialogContent className="rounded-[24px] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Nuova Richiesta</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Compila il modulo per inviare una nuova richiesta
            </DialogDescription>
          </DialogHeader>
          {activeStore?.id ? (
            <RequestForm
              department={department}
              storeId={activeStore.id}
              onClose={() => setShowRequestPopup(false)}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Seleziona uno store per inviare una richiesta.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "approve" ? "Approva richiesta" : "Rifiuta richiesta"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler {confirmAction?.type === "approve" ? "approvare" : "rifiutare"} la richiesta di{" "}
              <strong>{confirmAction?.request.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.type === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"}
              onClick={() => {
                if (!confirmAction) return;
                toast.success(
                  confirmAction.type === "approve"
                    ? `Richiesta di ${confirmAction.request.name} approvata`
                    : `Richiesta di ${confirmAction.request.name} rifiutata`
                );
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
