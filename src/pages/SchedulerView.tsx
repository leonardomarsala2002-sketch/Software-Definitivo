import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeList } from "@/hooks/useEmployees";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { ShiftRow } from "@/hooks/useShifts";
import { useCreateShift, useUpdateShift, useDeleteShift } from "@/hooks/useShifts";
import { useOpeningHours, useAllowedTimes } from "@/hooks/useStoreSettings";
import { DayDetailDialog } from "@/components/team-calendar/DayDetailDialog";

/* ─── helpers ───────────────────────────────────────────────────────── */

const DAYS_SHORT = ["L", "M", "M", "G", "V", "S", "D"];
const DAYS_LONG  = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS_IT  = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

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

function fmtDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
}

function shiftDuration(start: string, end: string): number {
  const sh = parseInt(start.split(":")[0], 10);
  const eh = parseInt(end.split(":")[0], 10) || 24;
  return Math.max(0, eh - sh);
}

function fmtTime(t: string): string {
  return t.slice(0, 5);
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

/* ─── Shift pill ─────────────────────────────────────────────────────── */

interface ShiftData {
  id: string;
  start_time: string;
  end_time: string;
  department: string;
  status: string;
}

function ShiftPill({ shift }: { shift: ShiftData }) {
  const isDraft = shift.status === "draft";
  const isSala  = shift.department === "sala";
  const hours   = shiftDuration(shift.start_time, shift.end_time);
  const start   = fmtTime(shift.start_time);
  const end     = fmtTime(shift.end_time);

  const base = cn(
    isDraft
      ? "border border-dashed border-amber-300 bg-amber-50 text-amber-700"
      : isSala
      ? "bg-indigo-100 text-indigo-800"
      : "bg-orange-100 text-orange-800"
  );

  return (
    <div className={cn(base, "rounded text-center leading-none px-0.5 py-0.5 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-left")}>
      <div className="sm:hidden">
        <div className="text-[9px] font-bold tabular-nums">{start}</div>
        <div className="text-[8px] font-medium tabular-nums opacity-75">{end}</div>
      </div>
      <div className="hidden sm:block">
        <div className="text-[11px] font-semibold tabular-nums">{start}–{end}</div>
        <div className="mt-0.5 text-[10px] opacity-70">{hours}h · {isSala ? "Sala" : "Cucina"}</div>
      </div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────── */

type DeptFilter = "all" | "sala" | "cucina";

export default function SchedulerView() {
  const { activeStore, stores: authStores, role, user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [deptFilter, setDeptFilter] = useState<DeptFilter>("all");
  const [showDraft, setShowDraft] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalDept, setModalDept] = useState<"sala" | "cucina">("sala");

  const storeId = activeStore?.id ?? authStores[0]?.id;

  const monday    = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const weekDates = useMemo(() => getWeekDates(monday), [monday]);
  const today     = new Date().toISOString().split("T")[0];

  const { data: employees = [] } = useEmployeeList(storeId ? [storeId] : undefined);
  const { data: openingHours = [] } = useOpeningHours(storeId);
  const { data: allowedTimes = [] } = useAllowedTimes(storeId);

  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();
  const qc = useQueryClient();

  const { data: shifts = [], isLoading, refetch } = useQuery({
    queryKey: ["scheduler-shifts", storeId, weekDates[0]],
    enabled: !!storeId,
    queryFn: async (): Promise<ShiftRow[]> => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("store_id", storeId!)
        .gte("date", weekDates[0])
        .lte("date", weekDates[6])
        .eq("is_day_off", false);
      if (error) throw error;
      return (data ?? []) as ShiftRow[];
    },
  });

  const { data: coverageReqs = [] } = useQuery({
    queryKey: ["scheduler-coverage", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_coverage_requirements")
        .select("day_of_week, hour_slot, department, min_staff_required")
        .eq("store_id", storeId!);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const dailyCoverage = useMemo(() => {
    return weekDates.map((date) => {
      const d   = new Date(date + "T00:00:00Z");
      const dow = (d.getUTCDay() + 6) % 7;
      const dayCovReqs = coverageReqs.filter((c) => c.day_of_week === dow);
      if (dayCovReqs.length === 0) return null;
      let covered = 0, total = 0;
      for (const req of dayCovReqs) {
        const h = parseInt(req.hour_slot.split(":")[0], 10);
        const assigned = shifts.filter((s) => {
          if (s.date !== date || s.is_day_off || !s.start_time || !s.end_time) return false;
          if (deptFilter !== "all" && s.department !== deptFilter) return false;
          const sh = parseInt(s.start_time.split(":")[0], 10);
          const eh = parseInt(s.end_time.split(":")[0], 10) || 24;
          return h >= sh && h < eh;
        }).length;
        total   += req.min_staff_required;
        covered += Math.min(assigned, req.min_staff_required);
      }
      return total > 0 ? Math.round((covered / total) * 100) : 100;
    });
  }, [weekDates, shifts, coverageReqs, deptFilter]);

  // Sort: current user first, then alphabetically
  const filteredEmployees = useMemo(() => {
    const list = deptFilter === "all"
      ? [...employees]
      : employees.filter((e) => e.department === deptFilter);
    return list.sort((a, b) => {
      if (a.user_id === user?.id) return -1;
      if (b.user_id === user?.id) return 1;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }, [employees, deptFilter, user?.id]);

  const getShiftsForCell = (userId: string, date: string) =>
    shifts.filter(
      (s) => s.user_id === userId && s.date === date && (showDraft || s.status === "published")
    );

  const allowedEntries = useMemo(
    () => allowedTimes.filter((t) => t.department === modalDept && t.kind === "entry" && t.is_active).map((t) => t.hour).sort((a, b) => a - b),
    [allowedTimes, modalDept]
  );
  const allowedExits = useMemo(
    () => allowedTimes.filter((t) => t.department === modalDept && t.kind === "exit" && t.is_active).map((t) => t.hour).sort((a, b) => a - b),
    [allowedTimes, modalDept]
  );

  const modalEmployees = useMemo(
    () => employees.filter((e) => e.department === modalDept).sort((a, b) => {
      if (a.user_id === user?.id) return -1;
      if (b.user_id === user?.id) return 1;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    }),
    [employees, modalDept, user?.id]
  );

  const canGenerate = ["admin", "store_manager", "super_admin"].includes(role ?? "");
  const canEdit     = canGenerate;
  const draftCount  = shifts.filter((s) => s.status === "draft").length;
  const weekLabel   = `${fmtDateShort(weekDates[0])} – ${fmtDateShort(weekDates[6])}`;

  function handleDayClick(date: string) {
    setSelectedDate(date);
    setModalDept(deptFilter === "cucina" ? "cucina" : "sala");
  }

  /* ─── render ─────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col gap-3 animate-fade-up">
      <style>{`
        .sched-grid { grid-template-columns: 36px repeat(7, 1fr); }
        @media (min-width: 640px) {
          .sched-grid { grid-template-columns: 160px repeat(7, minmax(88px, 1fr)); }
        }
        .day-header-btn:hover { background: rgba(99,102,241,0.07); cursor: pointer; }
      `}</style>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Scheduler</h1>
          <p className="text-[11px] text-slate-400">
            {draftCount > 0 ? `${draftCount} in bozza` : "Nessuna bozza"}
          </p>
        </div>
        {canGenerate && (
          <Link
            to="/team-calendar"
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Genera Mese</span>
            <span className="sm:hidden">Genera</span>
          </Link>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700 whitespace-nowrap"
          >
            {weekOffset === 0 ? "Questa sett." : weekLabel}
          </button>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {(["all", "sala", "cucina"] as DeptFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
                deptFilter === d
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
              )}
            >
              {d === "all" ? "Tutti" : d === "sala" ? "Sala" : "Cucina"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowDraft((v) => !v)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
            showDraft
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
          )}
        >
          {showDraft ? "Bozze ✓" : "Bozze"}
        </button>

        <button
          onClick={() => refetch()}
          className="ml-auto rounded-full border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:border-indigo-200 hover:text-indigo-600"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="h-full overflow-y-auto">

          {/* Day headers */}
          <div className="sched-grid sticky top-0 z-10 grid border-b-2 border-slate-200 bg-white/95 backdrop-blur-sm">
            <div className="flex items-center justify-center sm:justify-start sm:px-4 py-2 border-r border-slate-200">
              <Users className="h-3.5 w-3.5 text-slate-300" />
            </div>

            {weekDates.map((date, i) => {
              const isToday = date === today;
              const pct     = dailyCoverage[i];
              const dotColor =
                pct === null   ? "bg-slate-200"
                : pct >= 100   ? "bg-emerald-400"
                : pct >= 70    ? "bg-amber-400"
                : "bg-red-400";
              const dayNum = new Date(date + "T00:00:00Z").getUTCDate();

              return (
                <button
                  key={date}
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    "day-header-btn flex flex-col items-center justify-center py-2 border-l border-slate-200 transition-colors",
                    isToday ? "bg-indigo-50" : "hover:bg-indigo-50/60"
                  )}
                >
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-wider sm:hidden",
                    isToday ? "text-indigo-500" : "text-slate-400"
                  )}>
                    {DAYS_SHORT[i]}
                  </span>
                  <span className={cn(
                    "hidden text-[10px] font-bold uppercase tracking-wider sm:block",
                    isToday ? "text-indigo-600" : "text-slate-400"
                  )}>
                    {DAYS_LONG[i]}
                  </span>
                  <span className={cn(
                    "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold sm:h-6 sm:w-6 sm:text-[13px]",
                    isToday ? "bg-indigo-600 text-white" : "text-slate-700"
                  )}>
                    {dayNum}
                  </span>
                  {pct !== null && (
                    <span className={cn("mt-1 h-1 w-1 rounded-full sm:h-1.5 sm:w-1.5", dotColor)} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Employee rows */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-indigo-400" />
              <span className="text-[12px]">Caricamento…</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400">
              <Users className="mb-2 h-7 w-7 text-indigo-200" />
              <p className="text-[12px]">Nessun dipendente trovato</p>
            </div>
          ) : (
            filteredEmployees.map((emp, empIdx) => {
              const isMe = emp.user_id === user?.id;
              return (
                <div
                  key={emp.user_id}
                  className={cn(
                    "sched-grid grid border-b transition-colors hover:bg-slate-50/60",
                    isMe
                      ? "border-b-2 border-indigo-100 bg-indigo-50/30"
                      : empIdx % 2 === 0
                      ? "border-b border-slate-100 bg-white"
                      : "border-b border-slate-100 bg-slate-50/30"
                  )}
                >
                  {/* Employee cell */}
                  <div className={cn(
                    "flex items-center justify-center sm:justify-start gap-2 border-r px-1 sm:px-3 py-2",
                    isMe ? "border-r-indigo-100" : "border-r-slate-100"
                  )}>
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold sm:h-7 sm:w-7 sm:text-[10px] ring-2",
                        isMe ? "ring-indigo-300" : "ring-transparent",
                        emp.department === "sala"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-orange-100 text-orange-700"
                      )}
                    >
                      {initials(emp.full_name ?? "?")}
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <p className={cn(
                        "truncate text-[12px] font-semibold",
                        isMe ? "text-indigo-700" : "text-slate-800"
                      )}>
                        {emp.full_name}{isMe && " (tu)"}
                      </p>
                      <p className="text-[10px] text-slate-400">{emp.weekly_contract_hours}h/sett</p>
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
                          "border-l border-slate-100 p-0.5 sm:p-1 space-y-0.5 min-h-[50px] sm:min-h-[64px]",
                          isToday && "bg-indigo-50/30"
                        )}
                      >
                        {cellShifts.length === 0 ? (
                          <div className="flex h-full items-center justify-center">
                            <span className="text-[10px] text-slate-200">–</span>
                          </div>
                        ) : (
                          cellShifts.map((s) => (
                            <ShiftPill key={s.id} shift={s as ShiftData} />
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}

          {/* Coverage row */}
          {coverageReqs.length > 0 && !isLoading && (
            <div className="sched-grid sticky bottom-0 z-10 grid border-t-2 border-slate-200 bg-slate-50">
              <div className="flex items-center justify-center sm:justify-start sm:px-4 py-2 border-r border-slate-100">
                <span className="hidden text-[9px] font-semibold uppercase tracking-widest text-slate-400 sm:block">
                  Copertura
                </span>
              </div>
              {weekDates.map((date, i) => {
                const pct = dailyCoverage[i];
                if (pct === null) return <div key={date} className="border-l border-slate-100 py-2" />;
                const color =
                  pct >= 100 ? "bg-emerald-100 text-emerald-700"
                  : pct >= 70 ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700";
                return (
                  <div key={date} className="flex items-center justify-center border-l border-slate-100 py-2">
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", color)}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 sm:text-[11px]">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-indigo-100 sm:h-3 sm:w-3" />Sala
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-orange-100 sm:h-3 sm:w-3" />Cucina
        </span>
        {showDraft && (
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-amber-300 bg-amber-50 sm:h-3 sm:w-3" />Bozza
          </span>
        )}
        <span className="ml-auto">{filteredEmployees.length} dip. · {weekLabel}</span>
      </div>

      {/* ── Day detail modal ── */}
      {selectedDate && (
        <div>
          {/* Dept tab switcher shown above the dialog content */}
          <DayDetailDialog
            open={!!selectedDate}
            onOpenChange={(v) => { if (!v) setSelectedDate(null); }}
            date={selectedDate}
            department={modalDept}
            shifts={shifts}
            employees={modalEmployees}
            openingHours={openingHours}
            allowedEntries={allowedEntries}
            allowedExits={allowedExits}
            canEdit={canEdit}
            currentStoreId={storeId}
            onCreateShift={(s) =>
              createShift.mutate({ ...s, store_id: storeId!, department: modalDept, status: "draft", generation_run_id: null }, {
                onSuccess: () => { qc.invalidateQueries({ queryKey: ["scheduler-shifts", storeId, weekDates[0]] }); },
              })
            }
            onUpdateShift={(id, updates) => updateShift.mutate({ id, updates, storeId })}
            onDeleteShift={(id) => deleteShift.mutate({ id, storeId })}
          />
        </div>
      )}
    </div>
  );
}
