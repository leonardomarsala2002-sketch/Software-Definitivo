import {
  Calendar as CalendarIcon,
  FlaskConical,
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

const DAYS_IT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS_IT = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre",
];

function buildCalendarGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  // 0=Sun → we want Mon=0
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

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 08-19

/* ── card style ──────────────────────────────────────── */

const cardBase = "glass-card rounded-[12px] p-1";

/* all card variants use same soft glass style */
const cardProfile = cardBase;
const cardFerie = cardBase;
const cardCalendar = cardBase;
const cardRichiesteAdmin = cardBase;
const cardRichiesteUser = cardBase;
const cardAgenda = cardBase;

/* ── component ───────────────────────────────────────── */

const Dashboard = () => {
  const { user, role, activeStore } = useAuth();
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);
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

  const remainingVacation = 14; // placeholder

  /* seed (dev) */
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Devi essere loggato"); return; }
      const { data, error } = await supabase.functions.invoke("seed-employee-test-data");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message ?? "Dati test creati!");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Errore durante il seed";
      toast.error(errorMessage);
    } finally { setSeeding(false); }
  };

  const isAdmin = role === "admin" || role === "super_admin";

  /* pending requests (placeholder) */
  const pendingRequests = isAdmin
    ? [
        { id: "1", name: "Mario Rossi", type: "Ferie", dates: "10-14 Mar" },
        { id: "2", name: "Giulia Bianchi", type: "Permesso", dates: "12 Mar" },
      ]
    : [];

  /* agenda events (placeholder) */
  const agendaEvents: { id: string; day: number; hour: number; label: string }[] = [];

  /* dynamic subtitle */
  const subtitle = isAdmin && pendingRequests.length > 0
    ? `Hai ${pendingRequests.length} richieste in attesa e ${remainingVacation} giorni di ferie disponibili`
    : !isAdmin
      ? `Hai ${remainingVacation} giorni di ferie disponibili`
      : "Panoramica generale di tutti gli store e del team";

  return (
    <div className="flex h-full flex-col overflow-hidden animate-in fade-in duration-500">
      {/* Header – greeting */}
      <div className="mb-2 flex-shrink-0">
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          Benvenuto {displayName} 👋
        </h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {subtitle}
        </p>
      </div>

      {/* Bento Grid – fills viewport, no scroll */}
      <div className="flex-1 grid grid-cols-4 grid-rows-[auto_1fr] gap-3.5 min-h-0 overflow-hidden">

        {/* ── Row 1: Profile + Mini-Month + Ferie + Avvisi ── */}

        {/* User Profile Card */}
        <Card className={`${cardProfile} col-span-1 flex flex-col`}>
          <div className="flex items-center gap-1.5">
            <Avatar className="h-8 w-8 shadow-md flex-shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
              {role && (
                <Badge className="mt-0.5 text-[9px] px-1 py-0 bg-[rgba(0,200,83,0.14)] text-[#009624] border border-[rgba(0,200,83,0.35)] hover:bg-[rgba(0,200,83,0.2)]">
                  {roleLabelMap[role] || role}
                </Badge>
              )}
            </div>
          </div>

          {/* Action: new request */}
          <div className="mt-auto pt-1.5 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Nuova richiesta</span>
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 rounded-full border-border text-foreground/60 hover:text-foreground hover:border-foreground/30"
              onClick={() => setShowRequestPopup(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </Card>

        {/* Ferie Card (Vacation counter) */}
        <Card className={`${cardFerie} col-span-1 flex flex-col items-center justify-center`}>
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-accent mb-0.5">
            <Palmtree className="h-3 w-3 text-[#666]" />
          </div>
          <div className="relative flex h-11 w-11 items-center justify-center">
            <svg className="h-11 w-11 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="27" fill="none" stroke="currentColor"
                className="text-[#111]"
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(remainingVacation / 26) * 169.6} 169.6`}
              />
            </svg>
            <span className="absolute text-sm font-bold text-foreground">{remainingVacation}</span>
          </div>
          <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">Ferie rimaste</p>
        </Card>

        {/* Mini-Month Calendar Card */}
        <Card className={`${cardCalendar} col-span-1 flex flex-col`}>
          <CardHeader className="p-0 pb-0.5">
            <CardTitle className="flex items-center justify-between text-[10px] font-semibold text-foreground tracking-wide">
              <span className="font-bold">{MONTHS_IT[calMonth]} {calYear}</span>
              <div className="flex gap-0.5">
                <button onClick={prevMonth} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-accent transition-colors" aria-label="Mese precedente">
                  <ChevronLeft className="h-2.5 w-2.5" />
                </button>
                <button onClick={nextMonth} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-accent transition-colors" aria-label="Mese successivo">
                  <ChevronRight className="h-2.5 w-2.5" />
                </button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-0.5">
              {DAYS_IT.map((d, i) => (
                <span key={d} className={`text-center text-[8px] font-semibold uppercase tracking-wider text-muted-foreground ${i >= 5 ? "opacity-50" : ""}`}>{d}</span>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5 flex-1 content-start">
              {calendarCells.map((day, idx) => {
                const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                const isSelected = day !== null && selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear;
                const isWeekend = idx % 7 >= 5;
                return (
                  <button
                    key={idx}
                    disabled={day === null}
                    onClick={() => day !== null && setSelectedDate(new Date(calYear, calMonth, day))}
                    className={`mx-auto flex flex-col items-center justify-center h-5 w-5 rounded-full text-[9px] transition-colors
                      ${day === null ? "invisible" : ""}
                      ${isSelected ? "bg-primary text-primary-foreground font-bold" : ""}
                      ${isToday && !isSelected ? "bg-primary/10 text-foreground font-bold" : ""}
                      ${!isToday && !isSelected && day !== null ? "hover:bg-muted font-medium text-foreground/70" : ""}
                      ${isWeekend && !isSelected && !isToday ? "opacity-50" : ""}
                    `}
                  >
                    {day}
                    {isToday && day !== null && (
                      <span className="block h-0.5 w-0.5 rounded-full bg-[#111] -mt-px" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Richieste / Avvisi Card */}
        <Card className={`${isAdmin ? cardRichiesteAdmin : cardRichiesteUser} col-span-1 flex flex-col`}>
          <div className="flex items-center gap-1 mb-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-accent">
              {isAdmin ? (
                <Inbox className="h-3 w-3 text-[#666]" />
              ) : (
                <Bell className="h-3 w-3 text-[#666]" />
              )}
            </div>
            <p className="text-[10px] font-bold text-foreground">{isAdmin ? "Richieste" : "Avvisi"}</p>
          </div>
          {isAdmin && pendingRequests.length > 0 ? (
            <div className="flex-1 space-y-1 overflow-hidden">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#111] text-white text-[9px] font-bold px-1">
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

        {/* ── Row 2: Weekly Agenda (full width) — Inverted Axes ── */}
        <Card className={`${cardAgenda} col-span-4 flex flex-col min-h-0 overflow-hidden`}>
          <CardHeader className="p-0 pb-0.5 flex-shrink-0">
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
          <CardContent className={`flex-1 min-h-0 overflow-hidden p-0 ${agendaEvents.length === 0 ? "min-h-[80px]" : ""}`}>
            {agendaEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[80px] gap-1.5 py-4">
                <CalendarIcon className="h-6 w-6 text-muted-foreground/30" />
                <p className="text-[10px] font-medium text-muted-foreground">Nessun evento in programma questa settimana</p>
                <p className="text-[9px] text-muted-foreground/60">Gli eventi appariranno qui quando saranno pianificati</p>
              </div>
            ) : (
              /* Inverted axes: days as rows (vertical), hours as columns (horizontal) */
              <div className="grid grid-rows-[auto_repeat(7,1fr)] text-[9px] h-full"
                style={{ gridTemplateColumns: `3.5rem repeat(${HOURS.length}, minmax(0, 1fr))` }}>
                {/* Column headers: hours across the top */}
                <div className="bg-transparent" />
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="bg-transparent text-center pb-0.5 font-medium text-muted-foreground text-[9px]"
                  >
                    {String(hour).padStart(2, "0")}
                  </div>
                ))}
                {/* Day rows — day number next to name (e.g. Mar 24) */}
                {weekDates.map((d, i) => {
                  const isToday = d.toDateString() === today.toDateString();
                  return (
                    <div key={i} className="contents">
                      <div
                        className={`flex flex-row items-center justify-end gap-0.5 pr-1 border-t border-border/50 py-0.5
                          ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}
                      >
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium leading-tight
                          ${isToday ? "bg-primary text-primary-foreground rounded-full px-1.5 py-0.5" : ""}`}>
                          {DAYS_IT[i]} {d.getDate()}
                        </span>
                      </div>
                      {HOURS.map((hour) => (
                        <div key={hour} className="border-t border-border/30 py-0.5 min-h-[1rem]" />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
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

      {import.meta.env.DEV && (
        <div className="mt-2 flex justify-center flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
            className="gap-2 text-muted-foreground"
          >
            <FlaskConical className="h-4 w-4" />
            {seeding ? "Seeding…" : "Seed dati test dipendente"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
