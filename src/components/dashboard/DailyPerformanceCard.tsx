import { useState, useMemo, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Euro, TrendingUp, Target,
  BarChart3, Users, Wine, Cake, LayoutList, CalendarDays,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─── constants ─────────────────────────────────────────────── */
const DAYS_IT   = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

type PerfField = "revenue_actual" | "covers_count" | "budget_daily"
               | "dessert_pct" | "beverages_pct" | "sides_pct";
type EditKey   = `${string}:${PerfField}`;

interface DayData {
  revenue_actual: number;
  covers_count:   number;
  budget_daily:   number;
  dessert_pct:    number | null;
  beverages_pct:  number | null;
  sides_pct:      number | null;
}

/* ─── helpers ────────────────────────────────────────────────── */
function getWeekDates(offset = 0): string[] {
  const today = new Date();
  const dow   = today.getDay();
  const mon   = new Date(today);
  mon.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function shiftDateByYear(iso: string, years: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().split("T")[0];
}

function fmtDay(iso: string, idx: number) {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAYS_IT[idx]} ${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
}
function fmtDayShort(iso: string, idx: number) {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAYS_IT[idx]} ${d.getUTCDate()}`;
}
function fmtWeekLabel(dates: string[]) {
  const s = new Date(dates[0] + "T00:00:00Z");
  const e = new Date(dates[6] + "T00:00:00Z");
  const f = (d: Date) => `${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
  return `${f(s)} – ${f(e)}`;
}
function fmtEur(n: number) {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(n: number | null): string {
  if (n === null || n === 0) return "—";
  return `${n.toFixed(1)}%`;
}
function deltaPct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

/* ─── Delta badge ────────────────────────────────────────────── */
function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[10px] text-slate-300">n/d</span>;
  if (pct === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
      <Minus className="h-2.5 w-2.5" />0%
    </span>
  );
  const pos = pct > 0;
  return (
    <span className={cn("flex items-center gap-0.5 text-[10px] font-semibold",
      pos ? "text-emerald-600" : "text-red-500"
    )}>
      {pos ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {pos ? "+" : ""}{pct}%
    </span>
  );
}

/* ─── Budget badge ───────────────────────────────────────────── */
function BudgetBadge({ pct }: { pct: number }) {
  if (pct <= 0) return <span className="text-slate-300 text-[11px]">—</span>;
  const cls =
    pct >= 100 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    pct >= 80  ? "bg-amber-50 text-amber-700 border-amber-200"  :
                 "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", cls)}>
      {pct.toFixed(0)}%
    </span>
  );
}

/* ─── Editable cell ─────────────────────────────────────────── */
function EditableCell({
  date, field, value, displayFn, isInteger, editingCell, onStart, onCommit,
}: {
  date: string; field: PerfField; value: number | null;
  displayFn: (v: number) => string; isInteger: boolean;
  editingCell: EditKey | null;
  onStart: (key: EditKey, val: number) => void;
  onCommit: (date: string, field: PerfField) => void;
}) {
  const key = `${date}:${field}` as EditKey;
  const pending = useRef("");
  const v = value ?? 0;

  if (editingCell === key) {
    return (
      <input
        autoFocus type="number" min={0} step={isInteger ? 1 : 0.1}
        defaultValue={v === 0 ? "" : v}
        onChange={e => { pending.current = e.target.value; }}
        onBlur={() => { onCommit(date, field); }}
        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
        className="w-16 rounded border border-[#635bff] bg-[#f5f3ff] px-1.5 py-0.5 text-right text-[11px] font-semibold text-[#635bff] outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => { pending.current = String(v === 0 ? "" : v); onStart(key, v); }}
      title="Clicca per modificare"
      className={cn(
        "group min-w-[48px] rounded px-1.5 py-0.5 text-right text-[11px] transition-colors hover:bg-[#f5f3ff]",
        v === 0 ? "text-slate-300 italic" : "text-slate-800 font-medium"
      )}
    >
      {v === 0 ? "—" : displayFn(v)}
      <span className="ml-0.5 opacity-0 group-hover:opacity-40 text-[9px]">✏</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════ */
export function DailyPerformanceCard() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.id;
  const qc = useQueryClient();

  const [view, setView]           = useState<"weekly" | "daily">("weekly");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [localData, setLocalData]   = useState<Record<string, Partial<DayData>>>({});
  const [editingCell, setEditingCell] = useState<EditKey | null>(null);
  const pendingValue = useRef<string>("");

  const dates    = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const prevDates = useMemo(() => dates.map(d => shiftDateByYear(d, -1)), [dates]);
  const todayISO = new Date().toISOString().split("T")[0];

  /* ── Queries ─────────────────────────────────────────── */
  const { data: perfRows = [] } = useQuery({
    queryKey: ["daily-perf", storeId, dates[0]],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_performance")
        .select("date,revenue_actual,covers_count,budget_daily,dessert_pct,beverages_pct,sides_pct")
        .eq("store_id", storeId!)
        .gte("date", dates[0]).lte("date", dates[6]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: prevPerfRows = [] } = useQuery({
    queryKey: ["daily-perf-prev", storeId, prevDates[0]],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_performance")
        .select("date,revenue_actual,covers_count,budget_daily,dessert_pct,beverages_pct,sides_pct")
        .eq("store_id", storeId!)
        .gte("date", prevDates[0]).lte("date", prevDates[6]);
      return data ?? [];
    },
  });

  const { data: shiftHoursRaw = [] } = useQuery({
    queryKey: ["shift-hours-perf", storeId, dates[0]],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("date,start_time,end_time")
        .eq("store_id", storeId!)
        .eq("status", "published").eq("is_day_off", false)
        .gte("date", dates[0]).lte("date", dates[6]);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ── Derived state ───────────────────────────────────── */
  const shiftHours = useMemo(() => {
    const h: Record<string, number> = {};
    for (const s of shiftHoursRaw) {
      if (!s.start_time || !s.end_time) continue;
      const sh = parseInt(s.start_time.split(":")[0], 10);
      const eh = parseInt(s.end_time.split(":")[0], 10) || 24;
      h[s.date] = (h[s.date] ?? 0) + Math.max(0, eh - sh);
    }
    return h;
  }, [shiftHoursRaw]);

  const serverData = useMemo(() => {
    const m: Record<string, DayData> = {};
    for (const r of perfRows) {
      m[r.date] = {
        revenue_actual: r.revenue_actual ?? 0,
        covers_count:   r.covers_count ?? 0,
        budget_daily:   r.budget_daily ?? 0,
        dessert_pct:    r.dessert_pct ?? null,
        beverages_pct:  r.beverages_pct ?? null,
        sides_pct:      r.sides_pct ?? null,
      };
    }
    return m;
  }, [perfRows]);

  const prevData = useMemo(() => {
    const m: Record<string, DayData> = {};
    for (const r of prevPerfRows) {
      m[r.date] = {
        revenue_actual: r.revenue_actual ?? 0,
        covers_count:   r.covers_count ?? 0,
        budget_daily:   r.budget_daily ?? 0,
        dessert_pct:    r.dessert_pct ?? null,
        beverages_pct:  r.beverages_pct ?? null,
        sides_pct:      r.sides_pct ?? null,
      };
    }
    return m;
  }, [prevPerfRows]);

  function getVal(date: string, field: PerfField): number | null {
    const v = localData[date]?.[field] ?? serverData[date]?.[field] ?? null;
    if (field === "dessert_pct" || field === "beverages_pct" || field === "sides_pct") return v;
    return v ?? 0;
  }
  function getPrevVal(idx: number, field: PerfField): number | null {
    return prevData[prevDates[idx]]?.[field] ?? null;
  }

  /* ── Persistence ─────────────────────────────────────── */
  async function saveDay(date: string, overrides?: Partial<DayData>) {
    if (!storeId) return;
    const base  = serverData[date] ?? { revenue_actual: 0, covers_count: 0, budget_daily: 0, dessert_pct: null, beverages_pct: null, sides_pct: null };
    const local = localData[date] ?? {};
    const merged = { ...base, ...local, ...overrides };
    const { error } = await supabase
      .from("daily_performance")
      .upsert({ store_id: storeId, date, ...merged }, { onConflict: "store_id,date" });
    if (error) { toast.error("Errore nel salvataggio"); return; }
    qc.invalidateQueries({ queryKey: ["daily-perf", storeId, dates[0]] });
  }

  function startEdit(key: EditKey, currentVal: number) {
    pendingValue.current = String(currentVal === 0 ? "" : currentVal);
    setEditingCell(key);
  }

  function commitEdit(date: string, field: PerfField) {
    const raw = pendingValue.current;
    const isPct = field === "dessert_pct" || field === "beverages_pct" || field === "sides_pct";
    const num = field === "covers_count"
      ? (parseInt(raw, 10) || 0)
      : (parseFloat(raw.replace(",", ".")) || 0);
    const val = isPct ? (num || null) : num;
    setLocalData(prev => ({ ...prev, [date]: { ...prev[date], [field]: val } }));
    setEditingCell(null);
    saveDay(date, { [field]: val } as Partial<DayData>);
  }

  /* ── Weekly totals ───────────────────────────────────── */
  const totals = useMemo(() => {
    let revenue = 0, budget = 0, covers = 0, hours = 0;
    for (const date of dates) {
      revenue += (getVal(date, "revenue_actual") as number) ?? 0;
      budget  += (getVal(date, "budget_daily")   as number) ?? 0;
      covers  += (getVal(date, "covers_count")   as number) ?? 0;
      hours   += shiftHours[date] ?? 0;
    }
    const productivity = hours > 0 ? revenue / hours : 0;
    const budgetPct    = budget > 0 ? (revenue / budget) * 100 : 0;
    const budgetDiff   = revenue - budget;
    return { revenue, budget, covers, hours, productivity, budgetPct, budgetDiff };
  }, [dates, localData, serverData, shiftHours]);

  const prevTotals = useMemo(() => {
    let revenue = 0, budget = 0, covers = 0;
    for (const d of prevDates) {
      revenue += prevData[d]?.revenue_actual ?? 0;
      budget  += prevData[d]?.budget_daily   ?? 0;
      covers  += prevData[d]?.covers_count   ?? 0;
    }
    return { revenue, budget, covers };
  }, [prevDates, prevData]);

  const hasAnyData = dates.some(d => (getVal(d, "revenue_actual") as number) > 0);
  const hasPrevData = prevDates.some(d => (prevData[d]?.revenue_actual ?? 0) > 0);

  /* ── Render helpers ──────────────────────────────────── */
  const cellProps = { editingCell, onStart: startEdit, onCommit: commitEdit };

  /* ═══════════ WEEKLY VIEW ═══════════════════════════════ */
  function renderWeekly() {
    return (
      <>
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5 border-b border-slate-100">
          {[
            {
              label: "Incasso settimana",
              value: totals.revenue > 0 ? `€${fmtEur(totals.revenue)}` : "—",
              sub: hasPrevData ? <Delta pct={deltaPct(totals.revenue, prevTotals.revenue)} /> : null,
              icon: <Euro className="h-3.5 w-3.5" />,
              iconCls: "bg-[#f5f3ff] text-[#635bff]",
            },
            {
              label: "Budget settimana",
              value: totals.budget > 0 ? `€${fmtEur(totals.budget)}` : "—",
              sub: totals.budgetPct > 0 ? <BudgetBadge pct={totals.budgetPct} /> : null,
              icon: <Target className="h-3.5 w-3.5" />,
              iconCls: "bg-slate-100 text-slate-500",
            },
            {
              label: "Differenza budget",
              value: totals.budget > 0
                ? `${totals.budgetDiff >= 0 ? "+" : ""}€${fmtEur(totals.budgetDiff)}`
                : "—",
              sub: null,
              icon: <BarChart3 className="h-3.5 w-3.5" />,
              iconCls: totals.budgetDiff >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
              valCls: totals.budgetDiff >= 0 ? "text-emerald-700" : "text-red-600",
            },
            {
              label: "Produttività media",
              value: totals.productivity > 0 ? `€${totals.productivity.toFixed(1)}/h` : "—",
              sub: <span className="text-[10px] text-slate-400">{totals.hours}h staff</span>,
              icon: <TrendingUp className="h-3.5 w-3.5" />,
              iconCls: totals.productivity >= 40 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600",
            },
            {
              label: "Coperti totali",
              value: totals.covers > 0 ? totals.covers.toLocaleString("it-IT") : "—",
              sub: hasPrevData ? <Delta pct={deltaPct(totals.covers, prevTotals.covers)} /> : null,
              icon: <Users className="h-3.5 w-3.5" />,
              iconCls: "bg-blue-50 text-blue-600",
            },
          ].map((k) => (
            <div key={k.label} className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-3">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", k.iconCls)}>
                {k.icon}
              </span>
              <div className="min-w-0">
                <p className={cn("text-[15px] font-bold leading-none text-slate-800", (k as any).valCls)}>
                  {k.value}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{k.label}</p>
                {k.sub && <div className="mt-1">{k.sub}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Giorno","Incasso €","Budget €","Diff €","Coperti","Ore staff","€/ora","Dessert%","Bevande%","Contorni%","vs Budget"].map(h => (
                  <th key={h} className={cn(
                    "py-2.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400",
                    h === "Giorno" ? "px-4 text-left" : "px-2 text-right"
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dates.map((date, idx) => {
                const isToday   = date === todayISO;
                const revenue   = (getVal(date, "revenue_actual") as number) ?? 0;
                const budget    = (getVal(date, "budget_daily") as number) ?? 0;
                const covers    = (getVal(date, "covers_count") as number) ?? 0;
                const hours     = shiftHours[date] ?? 0;
                const prod      = hours > 0 && revenue > 0 ? revenue / hours : 0;
                const pct       = budget > 0 && revenue > 0 ? (revenue / budget) * 100 : 0;
                const diff      = budget > 0 ? revenue - budget : 0;
                const dessert   = getVal(date, "dessert_pct");
                const beverages = getVal(date, "beverages_pct");
                const sides     = getVal(date, "sides_pct");

                return (
                  <tr key={date} className={cn(
                    "transition-colors text-[11px]",
                    isToday ? "bg-[#f5f3ff]/50" : "hover:bg-slate-50/80"
                  )}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {isToday && <span className="h-1.5 w-1.5 rounded-full bg-[#635bff] shrink-0" />}
                        <span className={cn("font-medium", isToday ? "text-[#635bff]" : "text-slate-700")}>
                          {fmtDay(date, idx)}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <EditableCell date={date} field="revenue_actual" value={revenue}
                        displayFn={v => `€${fmtEur(v)}`} isInteger={false} {...cellProps} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <EditableCell date={date} field="budget_daily" value={budget}
                        displayFn={v => `€${fmtEur(v)}`} isInteger={false} {...cellProps} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      {diff !== 0 ? (
                        <span className={cn("font-semibold", diff >= 0 ? "text-emerald-600" : "text-red-500")}>
                          {diff >= 0 ? "+" : ""}€{fmtEur(diff)}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <EditableCell date={date} field="covers_count" value={covers}
                        displayFn={v => String(v)} isInteger={true} {...cellProps} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className={hours > 0 ? "text-slate-600 font-medium" : "text-slate-300 italic"}>
                        {hours > 0 ? `${hours}h` : "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {prod > 0 ? (
                        <span className={cn("font-semibold", prod >= 40 ? "text-emerald-600" : "text-amber-600")}>
                          €{prod.toFixed(1)}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <EditableCell date={date} field="dessert_pct" value={dessert as number}
                        displayFn={v => `${v.toFixed(1)}%`} isInteger={false} {...cellProps} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <EditableCell date={date} field="beverages_pct" value={beverages as number}
                        displayFn={v => `${v.toFixed(1)}%`} isInteger={false} {...cellProps} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <EditableCell date={date} field="sides_pct" value={sides as number}
                        displayFn={v => `${v.toFixed(1)}%`} isInteger={false} {...cellProps} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <BudgetBadge pct={pct} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-[11px]">
                <td className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">Totale</td>
                <td className="px-2 py-2 text-right text-slate-800">€{fmtEur(totals.revenue)}</td>
                <td className="px-2 py-2 text-right text-slate-500">€{fmtEur(totals.budget)}</td>
                <td className="px-2 py-2 text-right">
                  <span className={totals.budgetDiff >= 0 ? "text-emerald-600" : "text-red-500"}>
                    {totals.budgetDiff >= 0 ? "+" : ""}€{fmtEur(totals.budgetDiff)}
                  </span>
                </td>
                <td className="px-2 py-2 text-right text-slate-700">{totals.covers.toLocaleString("it-IT")}</td>
                <td className="px-2 py-2 text-right text-slate-500">{totals.hours}h</td>
                <td className="px-2 py-2 text-right">
                  {totals.productivity > 0 && (
                    <span className={cn("font-bold", totals.productivity >= 40 ? "text-emerald-600" : "text-amber-600")}>
                      €{totals.productivity.toFixed(1)}
                    </span>
                  )}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Anno precedente */}
        <div className="border-t border-slate-100">
          <div className="px-4 py-2.5 bg-slate-50/60 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Anno precedente ({new Date(prevDates[0] + "T00:00:00Z").getUTCFullYear()})
            </span>
            {!hasPrevData && (
              <span className="text-[10px] text-slate-300 italic">nessun dato</span>
            )}
          </div>
          {hasPrevData && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px]">
                <tbody className="divide-y divide-slate-50">
                  {prevDates.map((prevDate, idx) => {
                    const pd = prevData[prevDate];
                    const currRevenue = (getVal(dates[idx], "revenue_actual") as number) ?? 0;
                    const currCovers  = (getVal(dates[idx], "covers_count") as number) ?? 0;
                    if (!pd || pd.revenue_actual === 0) {
                      return (
                        <tr key={prevDate} className="text-[10px] text-slate-300">
                          <td className="px-4 py-2 w-[140px]">{fmtDay(prevDate, idx)}</td>
                          <td colSpan={10} className="px-2 py-2 italic">nessun dato</td>
                        </tr>
                      );
                    }
                    const prevProd = shiftHours[dates[idx]] > 0 ? pd.revenue_actual / shiftHours[dates[idx]] : 0;
                    const prevPct  = pd.budget_daily > 0 ? (pd.revenue_actual / pd.budget_daily) * 100 : 0;
                    const prevDiff = pd.budget_daily > 0 ? pd.revenue_actual - pd.budget_daily : 0;
                    return (
                      <tr key={prevDate} className="text-[10px] bg-slate-50/40 text-slate-500 hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-600 w-[140px]">{fmtDay(prevDate, idx)}</td>
                        <td className="px-2 py-2 text-right">
                          €{fmtEur(pd.revenue_actual)}
                          <div className="mt-0.5"><Delta pct={deltaPct(currRevenue, pd.revenue_actual)} /></div>
                        </td>
                        <td className="px-2 py-2 text-right">€{fmtEur(pd.budget_daily)}</td>
                        <td className="px-2 py-2 text-right">
                          {prevDiff !== 0 ? (
                            <span className={prevDiff >= 0 ? "text-emerald-500" : "text-red-400"}>
                              {prevDiff >= 0 ? "+" : ""}€{fmtEur(prevDiff)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {pd.covers_count}
                          <div className="mt-0.5"><Delta pct={deltaPct(currCovers, pd.covers_count)} /></div>
                        </td>
                        <td className="px-2 py-2 text-right text-slate-400">—</td>
                        <td className="px-2 py-2 text-right">
                          {prevProd > 0 ? `€${prevProd.toFixed(1)}` : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">{fmtPct(pd.dessert_pct)}</td>
                        <td className="px-2 py-2 text-right">{fmtPct(pd.beverages_pct)}</td>
                        <td className="px-2 py-2 text-right">{fmtPct(pd.sides_pct)}</td>
                        <td className="px-2 py-2 text-right"><BudgetBadge pct={prevPct} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 text-[10px] font-semibold text-slate-500 bg-slate-50">
                    <td className="px-4 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-300">Totale {new Date(prevDates[0] + "T00:00:00Z").getUTCFullYear()}</td>
                    <td className="px-2 py-2 text-right">
                      €{fmtEur(prevTotals.revenue)}
                      <div className="mt-0.5"><Delta pct={deltaPct(totals.revenue, prevTotals.revenue)} /></div>
                    </td>
                    <td className="px-2 py-2 text-right">€{fmtEur(prevTotals.budget)}</td>
                    <td className="px-2 py-2 text-right">
                      {prevTotals.budget > 0 ? (
                        <span className={prevTotals.revenue - prevTotals.budget >= 0 ? "text-emerald-500" : "text-red-400"}>
                          {prevTotals.revenue - prevTotals.budget >= 0 ? "+" : ""}€{fmtEur(prevTotals.revenue - prevTotals.budget)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {prevTotals.covers.toLocaleString("it-IT")}
                      <div className="mt-0.5"><Delta pct={deltaPct(totals.covers, prevTotals.covers)} /></div>
                    </td>
                    <td colSpan={6} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ═══════════ DAILY VIEW ════════════════════════════════ */
  function renderDaily() {
    const date    = dates[selectedDay];
    const prevDate= prevDates[selectedDay];
    const revenue   = (getVal(date, "revenue_actual") as number) ?? 0;
    const budget    = (getVal(date, "budget_daily") as number) ?? 0;
    const covers    = (getVal(date, "covers_count") as number) ?? 0;
    const hours     = shiftHours[date] ?? 0;
    const prod      = hours > 0 && revenue > 0 ? revenue / hours : 0;
    const pct       = budget > 0 && revenue > 0 ? (revenue / budget) * 100 : 0;
    const diff      = revenue - budget;
    const dessert   = getVal(date, "dessert_pct") as number | null;
    const beverages = getVal(date, "beverages_pct") as number | null;
    const sides     = getVal(date, "sides_pct") as number | null;
    const pd        = prevData[prevDate];

    return (
      <div className="p-4 space-y-4">
        {/* Day tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {dates.map((d, i) => (
            <button
              key={d}
              onClick={() => setSelectedDay(i)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors",
                selectedDay === i
                  ? "bg-[#635bff] text-white"
                  : d === todayISO
                  ? "bg-[#f5f3ff] text-[#635bff]"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {fmtDayShort(d, i)}
            </button>
          ))}
        </div>

        {/* KPI cards grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Incasso */}
          <KpiCard
            label="Incasso"
            editNode={<EditableCell date={date} field="revenue_actual" value={revenue}
              displayFn={v => `€${fmtEur(v)}`} isInteger={false} {...cellProps} />}
            delta={pd ? deltaPct(revenue, pd.revenue_actual) : null}
            icon={<Euro className="h-4 w-4" />}
            iconCls="bg-[#f5f3ff] text-[#635bff]"
          />
          {/* Budget */}
          <KpiCard
            label="Budget"
            editNode={<EditableCell date={date} field="budget_daily" value={budget}
              displayFn={v => `€${fmtEur(v)}`} isInteger={false} {...cellProps} />}
            icon={<Target className="h-4 w-4" />}
            iconCls="bg-slate-100 text-slate-500"
          />
          {/* Diff budget */}
          <KpiCard
            label="Differenza budget"
            value={budget > 0 ? `${diff >= 0 ? "+" : ""}€${fmtEur(diff)}` : "—"}
            valCls={budget > 0 ? (diff >= 0 ? "text-emerald-700" : "text-red-600") : undefined}
            sub={pct > 0 ? <BudgetBadge pct={pct} /> : undefined}
            icon={<BarChart3 className="h-4 w-4" />}
            iconCls={diff >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}
          />
          {/* Produttività */}
          <KpiCard
            label="Produttività oraria"
            value={prod > 0 ? `€${prod.toFixed(1)}/h` : "—"}
            valCls={prod >= 40 ? "text-emerald-700" : prod > 0 ? "text-amber-600" : undefined}
            sub={<span className="text-[10px] text-slate-400">{hours}h staff</span>}
            icon={<TrendingUp className="h-4 w-4" />}
            iconCls={prod >= 40 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}
          />
          {/* Coperti */}
          <KpiCard
            label="Coperti"
            editNode={<EditableCell date={date} field="covers_count" value={covers}
              displayFn={v => String(v)} isInteger={true} {...cellProps} />}
            delta={pd ? deltaPct(covers, pd.covers_count) : null}
            icon={<Users className="h-4 w-4" />}
            iconCls="bg-blue-50 text-blue-600"
          />
          {/* Dessert */}
          <KpiCard
            label="% Dessert"
            editNode={<EditableCell date={date} field="dessert_pct" value={dessert as number}
              displayFn={v => `${v.toFixed(1)}%`} isInteger={false} {...cellProps} />}
            delta={pd?.dessert_pct && dessert ? deltaPct(dessert, pd.dessert_pct) : null}
            icon={<Cake className="h-4 w-4" />}
            iconCls="bg-pink-50 text-pink-500"
          />
          {/* Bevande */}
          <KpiCard
            label="% Bevande"
            editNode={<EditableCell date={date} field="beverages_pct" value={beverages as number}
              displayFn={v => `${v.toFixed(1)}%`} isInteger={false} {...cellProps} />}
            delta={pd?.beverages_pct && beverages ? deltaPct(beverages, pd.beverages_pct) : null}
            icon={<Wine className="h-4 w-4" />}
            iconCls="bg-violet-50 text-violet-500"
          />
          {/* Dolci/Contorni */}
          <KpiCard
            label="% Dolci/Contorni"
            editNode={<EditableCell date={date} field="sides_pct" value={sides as number}
              displayFn={v => `${v.toFixed(1)}%`} isInteger={false} {...cellProps} />}
            delta={pd?.sides_pct && sides ? deltaPct(sides, pd.sides_pct) : null}
            icon={<Cake className="h-4 w-4" />}
            iconCls="bg-orange-50 text-orange-500"
          />
        </div>

        {/* Anno precedente */}
        {pd && pd.revenue_actual > 0 && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Stesso giorno {new Date(prevDate + "T00:00:00Z").getUTCFullYear()}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 text-[11px]">
              {[
                { label: "Incasso", value: `€${fmtEur(pd.revenue_actual)}`, delta: deltaPct(revenue, pd.revenue_actual) },
                { label: "Budget",  value: pd.budget_daily > 0 ? `€${fmtEur(pd.budget_daily)}` : "—", delta: null },
                { label: "Coperti", value: String(pd.covers_count), delta: deltaPct(covers, pd.covers_count) },
                { label: "Dessert%", value: fmtPct(pd.dessert_pct), delta: null },
                { label: "Bevande%", value: fmtPct(pd.beverages_pct), delta: null },
                { label: "Contorni%", value: fmtPct(pd.sides_pct), delta: null },
              ].map(k => (
                <div key={k.label} className="space-y-0.5">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">{k.label}</p>
                  <p className="font-semibold text-slate-600">{k.value}</p>
                  {k.delta !== null && <Delta pct={k.delta} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ═══════════ ROOT ══════════════════════════════════════ */
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#635bff]" />
            Performance & Budget
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Clicca un valore per modificarlo · dati manuali in grassetto · ore staff da turni pubblicati
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView("weekly")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors",
                view === "weekly" ? "bg-[#635bff] text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <LayoutList className="h-3 w-3" />Settimana
            </button>
            <button
              onClick={() => setView("daily")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors",
                view === "daily" ? "bg-[#635bff] text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <CalendarDays className="h-3 w-3" />Giorno
            </button>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[11px] font-medium text-slate-600 w-[140px] text-center">
              {fmtWeekLabel(dates)}
            </span>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 0}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {view === "weekly" ? renderWeekly() : renderDaily()}

      <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/40">
        <p className="text-[9px] text-slate-300">
          Ore staff = turni pubblicati · €/ora = Incasso ÷ Ore staff · vs Anno prec. = stessa settimana calendario anno precedente
        </p>
      </div>
    </div>
  );
}

/* ─── KpiCard daily ─────────────────────────────────────── */
function KpiCard({
  label, value, valCls, editNode, sub, delta, icon, iconCls,
}: {
  label: string;
  value?: string;
  valCls?: string;
  editNode?: React.ReactNode;
  sub?: React.ReactNode;
  delta?: number | null;
  icon: React.ReactNode;
  iconCls: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconCls)}>
          {icon}
        </span>
        {delta !== undefined && delta !== null && <Delta pct={delta} />}
      </div>
      <div>
        <p className="text-[10px] text-slate-400 leading-tight">{label}</p>
        <div className={cn("text-[15px] font-bold text-slate-800 mt-0.5", valCls)}>
          {editNode ?? value ?? "—"}
        </div>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </div>
  );
}
