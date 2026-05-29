import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw, Clock, Users, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeList } from "@/hooks/useEmployees";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

/* ─── helpers ───────────────────────────────────────────────────────── */

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function getMondayOfWeek(offset: number): Date {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
}

function shiftDuration(start: string, end: string): number {
  const sh = parseInt(start.split(":")[0], 10);
  const eh = parseInt(end.split(":")[0], 10) || 24;
  return Math.max(0, eh - sh);
}

/* ─── Shift cell ─────────────────────────────────────────────────────── */

interface ShiftCellData {
  id: string;
  start_time: string;
  end_time: string;
  department: string;
  is_draft: boolean;
}

function ShiftPill({ shift }: { shift: ShiftCellData }) {
  const isDraft = shift.is_draft;
  const isSala = shift.department === "sala";
  const hours = shiftDuration(shift.start_time, shift.end_time);

  return (
    <div
      className={cn(
        "rounded-lg px-2 py-1.5 text-[11px] font-semibold leading-tight transition-all hover:shadow-sm",
        isDraft
          ? "border border-dashed border-amber-300 bg-amber-50 text-amber-700"
          : isSala
          ? "bg-indigo-100 text-indigo-800"
          : "bg-orange-100 text-orange-800"
      )}
    >
      <div className="flex items-center gap-1">
        <Clock className="h-2.5 w-2.5 shrink-0" />
        <span>{shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</span>
      </div>
      <div className="mt-0.5 text-[10px] opacity-70">{hours}h · {isSala ? "Sala" : "Cucina"}</div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

type DeptFilter = "all" | "sala" | "cucina";

export default function SchedulerView() {
  const { activeStore, stores: authStores, role } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [deptFilter, setDeptFilter] = useState<DeptFilter>("all");
  const [showDraft, setShowDraft] = useState(true);

  const storeId = activeStore?.id ?? authStores[0]?.id;

  const monday = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const weekDates = useMemo(() => getWeekDates(monday), [monday]);

  const { data: employees = [] } = useEmployeeList(storeId ? [storeId] : undefined);

  const { data: shifts = [], isLoading, refetch } = useQuery({
    queryKey: ["scheduler-shifts", storeId, weekDates[0]],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, department, is_draft, is_day_off, user_id")
        .eq("store_id", storeId!)
        .gte("date", weekDates[0])
        .lte("date", weekDates[6])
        .eq("is_day_off", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredEmployees = useMemo(() => {
    if (deptFilter === "all") return employees;
    return employees.filter((e) => e.department === deptFilter);
  }, [employees, deptFilter]);

  const getShiftsForCell = (userId: string, date: string) =>
    shifts.filter(
      (s) =>
        s.user_id === userId &&
        s.date === date &&
        (showDraft || !s.is_draft)
    );

  const weekLabel = `${fmtDate(weekDates[0])} – ${fmtDate(weekDates[6])}`;
  const today = new Date().toISOString().split("T")[0];

  const canGenerate = ["admin", "store_manager", "super_admin"].includes(role ?? "");

  const draftCount = shifts.filter((s) => s.is_draft).length;
  const publishedCount = shifts.filter((s) => !s.is_draft).length;

  return (
    <div className="flex h-full flex-col gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Shift Scheduler</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">
            {publishedCount} turni pubblicati · {draftCount} in bozza
          </p>
        </div>

        {canGenerate && (
          <Link
            to="/team-calendar"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            Genera Mese
          </Link>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Week navigator */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="rounded-lg px-3 py-1 text-[12px] font-medium text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
          >
            {weekOffset === 0 ? "Questa settimana" : weekLabel}
          </button>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Dept filter */}
        <div className="flex items-center gap-1.5">
          {(["all", "sala", "cucina"] as DeptFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",
                deptFilter === d
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
              )}
            >
              {d === "all" ? "Tutti" : d === "sala" ? "Sala" : "Cucina"}
            </button>
          ))}
        </div>

        {/* Draft toggle */}
        <button
          onClick={() => setShowDraft((v) => !v)}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all",
            showDraft
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
          )}
        >
          {showDraft ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          Bozze
        </button>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-400 transition-colors hover:border-indigo-200 hover:text-indigo-600"
          title="Aggiorna"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-auto scrollbar-hide">
        {/* Day headers */}
        <div
          className="sticky top-0 z-10 grid border-b border-slate-100 bg-white/95 backdrop-blur-sm"
          style={{ gridTemplateColumns: `200px repeat(7, minmax(110px, 1fr))` }}
        >
          <div className="flex items-center px-4 py-3">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              <Users className="h-3.5 w-3.5" />
              Dipendente
            </span>
          </div>
          {weekDates.map((date, i) => {
            const isToday = date === today;
            return (
              <div
                key={date}
                className={cn(
                  "flex flex-col items-center justify-center py-3 px-1 border-l border-slate-100",
                  isToday && "bg-indigo-50"
                )}
              >
                <span className={cn(
                  "text-[11px] font-semibold uppercase tracking-wide",
                  isToday ? "text-indigo-600" : "text-slate-400"
                )}>
                  {DAYS[i]}
                </span>
                <span className={cn(
                  "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-bold",
                  isToday ? "bg-indigo-600 text-white" : "text-slate-700"
                )}>
                  {new Date(date + "T00:00:00Z").getUTCDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Employee rows */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin text-indigo-400" />
            <span className="text-[13px]">Caricamento turni…</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-400">
            <Users className="mb-3 h-8 w-8 text-indigo-200" />
            <p className="text-[13px]">Nessun dipendente trovato</p>
          </div>
        ) : (
          filteredEmployees.map((emp, empIdx) => (
            <div
              key={emp.user_id}
              className={cn(
                "grid border-b border-slate-50 hover:bg-slate-50/50 transition-colors",
                empIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
              )}
              style={{ gridTemplateColumns: `200px repeat(7, minmax(110px, 1fr))` }}
            >
              {/* Employee name */}
              <div className="flex items-center gap-2.5 border-r border-slate-100 px-4 py-3">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    emp.department === "sala"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-orange-100 text-orange-700"
                  )}
                >
                  {emp.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("") ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-slate-800">
                    {emp.full_name ?? "—"}
                  </p>
                  <p className="text-[10.5px] text-slate-400">{emp.weekly_contract_hours}h/sett</p>
                </div>
              </div>

              {/* Day cells */}
              {weekDates.map((date) => {
                const cellShifts = getShiftsForCell(emp.user_id, date);
                const isToday = date === today;
                return (
                  <div
                    key={date}
                    className={cn(
                      "border-l border-slate-100 p-1.5 space-y-1 min-h-[64px]",
                      isToday && "bg-indigo-50/50"
                    )}
                  >
                    {cellShifts.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-[11px] text-slate-200">—</span>
                      </div>
                    ) : (
                      cellShifts.map((s) => (
                        <ShiftPill key={s.id} shift={s as ShiftCellData} />
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-indigo-100" />Sala
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-orange-100" />Cucina
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-dashed border-amber-300 bg-amber-50" />Bozza
        </span>
        <span className="ml-auto">
          {filteredEmployees.length} dipendenti · settimana {weekLabel}
        </span>
      </div>
    </div>
  );
}
