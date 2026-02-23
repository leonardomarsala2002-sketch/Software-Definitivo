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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

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

const cardBase =
  "rounded-[32px] border border-border/60 bg-card shadow-2xl shadow-black/[0.04] dark:shadow-black/[0.12] p-5";

/* ── component ───────────────────────────────────────── */

const Dashboard = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header – compact */}
      <div className="mb-3 flex-shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Panoramica generale di tutti gli store e del team
        </p>
      </div>

      {/* Bento Grid – fills viewport, no scroll */}
      <div className="flex-1 grid grid-cols-4 grid-rows-[auto_1fr] gap-4 min-h-0 overflow-hidden">

        {/* ── Row 1: Profile + Mini-Month + Ferie + Avvisi ── */}

        {/* User Profile Card */}
        <Card className={`${cardBase} col-span-1 flex flex-col`}>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 shadow-md flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground">
                {role ? roleLabelMap[role] || role : ""}
              </p>
            </div>
          </div>

          {/* Action: new request */}
          <div className="mt-auto pt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Nuova richiesta</span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 rounded-full"
              onClick={() => navigate("/requests")}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>

        {/* Ferie Card (Vacation counter) */}
        <Card className={`${cardBase} col-span-1 flex flex-col items-center justify-center`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 mb-2">
            <Palmtree className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="27" fill="none" stroke="currentColor"
                className="text-emerald-500"
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(remainingVacation / 26) * 169.6} 169.6`}
              />
            </svg>
            <span className="absolute text-lg font-bold text-foreground">{remainingVacation}</span>
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">Ferie rimaste</p>
        </Card>

        {/* Mini-Month Calendar Card */}
        <Card className={`${cardBase} col-span-1 flex flex-col`}>
          <CardHeader className="p-0 pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-semibold text-foreground tracking-wide">
              <span className="font-bold">{MONTHS_IT[calMonth]} {calYear}</span>
              <div className="flex gap-0.5">
                <button onClick={prevMonth} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent transition-colors" aria-label="Mese precedente">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button onClick={nextMonth} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent transition-colors" aria-label="Mese successivo">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_IT.map((d) => (
                <span key={d} className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">{d}</span>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5 flex-1 content-start">
              {calendarCells.map((day, idx) => {
                const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                const isSelected = day !== null && selectedDate.getDate() === day && selectedDate.getMonth() === calMonth && selectedDate.getFullYear() === calYear;
                return (
                  <button
                    key={idx}
                    disabled={day === null}
                    onClick={() => day !== null && setSelectedDate(new Date(calYear, calMonth, day))}
                    className={`mx-auto flex flex-col items-center justify-center h-7 w-7 rounded-full text-[10px] transition-colors
                      ${day === null ? "invisible" : ""}
                      ${isSelected ? "bg-primary text-primary-foreground font-bold" : ""}
                      ${isToday && !isSelected ? "bg-accent text-accent-foreground font-bold" : ""}
                      ${!isToday && !isSelected && day !== null ? "hover:bg-accent/60 font-medium" : ""}
                    `}
                  >
                    {day}
                    {isToday && day !== null && (
                      <span className="block h-1 w-1 rounded-full bg-emerald-500 -mt-px" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Avvisi Richieste Card (Pending requests alert) */}
        <Card className={`${cardBase} col-span-1 flex flex-col`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
              <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-xs font-bold text-foreground">Avvisi</p>
          </div>
          {isAdmin && pendingRequests.length > 0 ? (
            <div className="flex-1 space-y-1.5 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5">
                  {pendingRequests.length}
                </span>
                <span className="text-[11px] text-muted-foreground">richieste in attesa</span>
              </div>
              {pendingRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{r.name}</span>
                    <span className="ml-1 text-muted-foreground text-[10px]">· {r.type}</span>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" aria-label="Approva richiesta">
                      <Check className="h-2.5 w-2.5" />
                    </button>
                    <button className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400" aria-label="Rifiuta richiesta">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[11px] text-muted-foreground">Nessuna richiesta pendente</p>
            </div>
          )}
        </Card>

        {/* ── Row 2: Weekly Agenda (full width) — Inverted Axes ── */}
        <Card className={`${cardBase} col-span-4 flex flex-col min-h-0 overflow-hidden`}>
          <CardHeader className="p-0 pb-2 flex-shrink-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
                <CalendarIcon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              </div>
              Agenda Settimanale
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {weekDates[0].getDate()} – {weekDates[6].getDate()} {MONTHS_IT[weekDates[0].getMonth()]}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto p-0">
            {/* Inverted axes: days as rows (vertical), hours as columns (horizontal) */}
            <div className="grid grid-rows-[auto_repeat(7,1fr)] text-[10px] min-h-0"
              style={{ gridTemplateColumns: `3rem repeat(${HOURS.length}, minmax(0, 1fr))` }}>
              {/* Column headers: hours across the top */}
              <div className="sticky top-0 bg-card z-10" />
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="sticky top-0 z-10 bg-card text-center pb-1 font-medium text-muted-foreground"
                >
                  {String(hour).padStart(2, "0")}
                </div>
              ))}
              {/* Day rows */}
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <div key={i} className="contents">
                    <div
                      className={`flex flex-col items-center justify-center pr-2 border-t border-border/30 py-1
                        ${isToday ? "text-primary" : "text-muted-foreground"}`}
                    >
                      <span className="block text-[10px] font-medium">{DAYS_IT[i]}</span>
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]
                        ${isToday ? "bg-primary text-primary-foreground" : ""}`}>
                        {d.getDate()}
                      </span>
                    </div>
                    {HOURS.map((hour) => (
                      <div key={hour} className="border-t border-border/30 py-1 min-h-[1.5rem]" />
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

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
