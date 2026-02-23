import {
  Calendar as CalendarIcon,
  FlaskConical,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
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
  "rounded-[32px] border border-border/60 bg-card shadow-[0_25px_50px_-12px_rgba(0,0,0,0.05)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] p-6";

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
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Panoramica generale di tutti gli store e del team
        </p>
      </div>

      {/* Bento Grid – fills viewport, no scroll */}
      <div className="flex-1 grid grid-cols-4 grid-rows-[auto_1fr] gap-6 min-h-0 overflow-hidden">

        {/* ── Row 1: Profile + Mini-Month ──────────────────── */}

        {/* User Profile Card */}
        <Card className={`${cardBase} col-span-2 flex flex-col`}>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 shadow-md flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {role ? roleLabelMap[role] || role : ""}
              </p>
            </div>
            {/* Circular vacation counter */}
            <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="4" />
                <circle
                  cx="28" cy="28" r="24" fill="none" stroke="currentColor"
                  className="text-emerald-500"
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(remainingVacation / 26) * 150.8} 150.8`}
                />
              </svg>
              <span className="absolute text-xs font-bold text-foreground">{remainingVacation}</span>
            </div>
          </div>

          <p className="mt-1 text-[10px] text-muted-foreground text-right">Ferie rimaste</p>

          {/* Action: new request */}
          <div className="mt-auto pt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Nuova richiesta</span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full"
              onClick={() => navigate("/requests")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Admin: pending requests */}
          {isAdmin && pendingRequests.length > 0 && (
            <div className="mt-3 border-t border-border/40 pt-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Richieste pendenti
              </p>
              {pendingRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{r.name}</span>
                    <span className="ml-1 text-muted-foreground">· {r.type} · {r.dates}</span>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" aria-label="Approva richiesta">
                      <Check className="h-3 w-3" />
                    </button>
                    <button className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400" aria-label="Rifiuta richiesta">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Mini-Month Calendar Card */}
        <Card className={`${cardBase} col-span-2 flex flex-col`}>
          <CardHeader className="p-0 pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-foreground">
              <span>{MONTHS_IT[calMonth]} {calYear}</span>
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
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_IT.map((d) => (
                <span key={d} className="text-center text-[10px] font-medium text-muted-foreground">{d}</span>
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
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors
                      ${day === null ? "invisible" : ""}
                      ${isSelected ? "bg-primary text-primary-foreground" : ""}
                      ${isToday && !isSelected ? "bg-accent text-accent-foreground font-semibold" : ""}
                      ${!isToday && !isSelected && day !== null ? "hover:bg-accent/60" : ""}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Row 2: Weekly Agenda (full width) ────────────── */}
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
            <div className="grid grid-cols-[3rem_repeat(7,1fr)] text-[10px] min-h-0">
              {/* Column headers */}
              <div className="sticky top-0 bg-card z-10" />
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <div
                    key={i}
                    className={`sticky top-0 z-10 bg-card text-center pb-1 font-medium
                      ${isToday ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <span className="block">{DAYS_IT[i]}</span>
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]
                      ${isToday ? "bg-primary text-primary-foreground" : ""}`}>
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
              {/* Hour rows */}
              {HOURS.map((hour) => (
                <div key={hour} className="contents">
                  <div className="pr-2 text-right text-muted-foreground border-t border-border/30 py-1">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {weekDates.map((_, di) => (
                    <div key={di} className="border-t border-border/30 py-1 min-h-[1.5rem]" />
                  ))}
                </div>
              ))}
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
