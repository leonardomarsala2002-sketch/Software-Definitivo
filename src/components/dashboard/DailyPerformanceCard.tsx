import { useState, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Euro, TrendingUp, Target, BarChart3 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAYS_IT   = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

type PerfField = "revenue_actual" | "covers_count" | "budget_daily";
type EditKey   = `${string}:${PerfField}`;

interface LocalData { revenue_actual: number; covers_count: number; budget_daily: number }

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

function fmtDay(iso: string, idx: number) {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAYS_IT[idx]} ${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
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

export function DailyPerformanceCard() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.id;
  const qc = useQueryClient();

  const [weekOffset, setWeekOffset]     = useState(0);
  const [localData, setLocalData]       = useState<Record<string, Partial<LocalData>>>({});
  const [editingCell, setEditingCell]   = useState<EditKey | null>(null);
  const pendingValue = useRef<string>("");

  const dates    = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const todayISO = new Date().toISOString().split("T")[0];

  // ── Server data ───────────────────────────────────────────
  const { data: perfRows = [] } = useQuery({
    queryKey: ["daily-perf", storeId, dates[0]],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_performance")
        .select("date, revenue_actual, covers_count, budget_daily")
        .eq("store_id", storeId!)
        .gte("date", dates[0])
        .lte("date", dates[6]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: shiftHoursRaw = [] } = useQuery({
    queryKey: ["shift-hours-perf", storeId, dates[0]],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("date, start_time, end_time")
        .eq("store_id", storeId!)
        .eq("is_draft", false)
        .eq("is_day_off", false)
        .gte("date", dates[0])
        .lte("date", dates[6]);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Derived state ─────────────────────────────────────────
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
    const m: Record<string, LocalData> = {};
    for (const r of perfRows) {
      m[r.date] = {
        revenue_actual: r.revenue_actual ?? 0,
        covers_count:   r.covers_count ?? 0,
        budget_daily:   r.budget_daily ?? 0,
      };
    }
    return m;
  }, [perfRows]);

  function getVal(date: string, field: PerfField): number {
    return (localData[date]?.[field] ?? serverData[date]?.[field]) ?? 0;
  }

  // ── Persistence ───────────────────────────────────────────
  async function saveDay(date: string, overrides?: Partial<LocalData>) {
    if (!storeId) return;
    const base  = serverData[date] ?? { revenue_actual: 0, covers_count: 0, budget_daily: 0 };
    const local = localData[date] ?? {};
    const merged = { ...base, ...local, ...overrides };

    const { error } = await supabase
      .from("daily_performance")
      .upsert(
        { store_id: storeId, date, ...merged },
        { onConflict: "store_id,date" }
      );

    if (error) { toast.error("Errore nel salvataggio"); return; }
    qc.invalidateQueries({ queryKey: ["daily-perf", storeId, dates[0]] });
  }

  // ── Cell editing ──────────────────────────────────────────
  function startEdit(key: EditKey, currentVal: number) {
    pendingValue.current = String(currentVal === 0 ? "" : currentVal);
    setEditingCell(key);
  }

  function commitEdit(date: string, field: PerfField) {
    const raw = pendingValue.current;
    const num = field === "covers_count"
      ? (parseInt(raw, 10) || 0)
      : (parseFloat(raw.replace(",", ".")) || 0);

    setLocalData(prev => ({
      ...prev,
      [date]: { ...prev[date], [field]: num },
    }));
    setEditingCell(null);
    saveDay(date, { [field]: num });
  }

  // ── Totals ────────────────────────────────────────────────
  const totals = useMemo(() => {
    let revenue = 0, budget = 0, covers = 0, hours = 0;
    for (const date of dates) {
      revenue += getVal(date, "revenue_actual");
      budget  += getVal(date, "budget_daily");
      covers  += getVal(date, "covers_count");
      hours   += shiftHours[date] ?? 0;
    }
    const productivity = hours > 0 ? revenue / hours : 0;
    const budgetPct    = budget > 0 ? (revenue / budget) * 100 : 0;
    return { revenue, budget, covers, hours, productivity, budgetPct };
  }, [dates, localData, serverData, shiftHours]);

  // ── Render helpers ────────────────────────────────────────
  function renderEditableCell(
    date: string,
    field: PerfField,
    displayFn: (v: number) => string,
    isInteger: boolean
  ) {
    const key = `${date}:${field}` as EditKey;
    const val = getVal(date, field);

    if (editingCell === key) {
      return (
        <input
          autoFocus
          type="number"
          min={0}
          step={isInteger ? 1 : 0.5}
          defaultValue={val === 0 ? "" : val}
          onChange={e => { pendingValue.current = e.target.value; }}
          onBlur={() => commitEdit(date, field)}
          onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
          className="w-20 rounded border border-primary bg-accent/50 px-2 py-0.5 text-right text-[12px] font-semibold text-primary outline-none focus:ring-1 focus:ring-primary"
        />
      );
    }

    return (
      <button
        onClick={() => startEdit(key, val)}
        title="Clicca per modificare"
        className={cn(
          "group min-w-[56px] rounded px-2 py-0.5 text-right text-[12px] transition-colors hover:bg-muted",
          val === 0 ? "text-muted-foreground/50 italic" : "text-foreground font-medium"
        )}
      >
        {val === 0 ? "—" : displayFn(val)}
        <span className="ml-0.5 opacity-0 group-hover:opacity-30 text-[9px]">✏</span>
      </button>
    );
  }

  function BudgetPctBadge({ pct }: { pct: number }) {
    if (pct <= 0) return <span className="text-muted-foreground text-[11px]">—</span>;
    const cls =
      pct >= 100 ? "bg-success/10 text-success" :
      pct >= 80  ? "bg-warning/10 text-warning" :
                   "bg-destructive/10 text-destructive";
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", cls)}>
        {pct.toFixed(0)}%
      </span>
    );
  }

  // ── UI ────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-[13px] font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Produttività &amp; Budget
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Clicca un valore per modificarlo · Salvataggio automatico</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[12px] font-medium text-foreground w-[150px] text-center">
            {fmtWeekLabel(dates)}
          </span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            disabled={weekOffset >= 0}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {[
          {
            label: "Incasso settimana",
            value: `€${fmtEur(totals.revenue)}`,
            sub: `Budget €${fmtEur(totals.budget)}`,
            icon: <Euro className="h-3.5 w-3.5" />,
            color: "text-primary",
            bg: "bg-accent",
          },
          {
            label: "Produttività media",
            value: totals.productivity > 0 ? `€${totals.productivity.toFixed(1)}/h` : "—",
            sub: `${totals.hours} ore staff`,
            icon: <TrendingUp className="h-3.5 w-3.5" />,
            color: totals.productivity >= 40 ? "text-success" : totals.productivity > 0 ? "text-warning" : "text-muted-foreground",
            bg: totals.productivity >= 40 ? "bg-success/10" : "bg-warning/10",
          },
          {
            label: "vs Budget settimana",
            value: totals.budgetPct > 0 ? `${totals.budgetPct.toFixed(0)}%` : "—",
            sub: `${totals.covers.toLocaleString("it-IT")} coperti totali`,
            icon: <Target className="h-3.5 w-3.5" />,
            color: totals.budgetPct >= 100 ? "text-success" : totals.budgetPct >= 80 ? "text-warning" : totals.budgetPct > 0 ? "text-destructive" : "text-muted-foreground",
            bg: totals.budgetPct >= 100 ? "bg-success/10" : totals.budgetPct >= 80 ? "bg-warning/10" : "bg-destructive/10",
          },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2.5 px-4 py-3">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", s.bg, s.color)}>
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className={cn("text-[17px] font-bold leading-none", s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.label}</p>
              <p className="text-[10px] text-muted-foreground/70 truncate">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table — scrollable on mobile */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {["Giorno", "Incasso €", "Budget €", "Coperti", "Ore staff", "€/ora", "vs Budget"].map(h => (
                <th
                  key={h}
                  className={cn(
                    "py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
                    h === "Giorno" ? "px-4 text-left" : "px-3 text-right"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dates.map((date, idx) => {
              const isToday   = date === todayISO;
              const revenue   = getVal(date, "revenue_actual");
              const budget    = getVal(date, "budget_daily");
              const hours     = shiftHours[date] ?? 0;
              const prod      = hours > 0 && revenue > 0 ? revenue / hours : 0;
              const pct       = budget > 0 && revenue > 0 ? (revenue / budget) * 100 : 0;

              return (
                <tr
                  key={date}
                  className={cn(
                    "transition-colors",
                    isToday ? "bg-accent/20" : "hover:bg-muted/10"
                  )}
                >
                  {/* Giorno */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {isToday && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      <span className={cn("text-[12px] font-medium", isToday ? "text-primary" : "text-foreground")}>
                        {fmtDay(date, idx)}
                      </span>
                    </div>
                  </td>

                  {/* Incasso */}
                  <td className="px-3 py-2">
                    {renderEditableCell(date, "revenue_actual", v => `€${fmtEur(v)}`, false)}
                  </td>

                  {/* Budget */}
                  <td className="px-3 py-2">
                    {renderEditableCell(date, "budget_daily", v => `€${fmtEur(v)}`, false)}
                  </td>

                  {/* Coperti */}
                  <td className="px-3 py-2">
                    {renderEditableCell(date, "covers_count", v => String(v), true)}
                  </td>

                  {/* Ore staff (auto) */}
                  <td className="px-3 py-2 text-right">
                    <span className={cn("text-[12px]", hours > 0 ? "text-foreground font-medium" : "text-muted-foreground/50 italic")}>
                      {hours > 0 ? `${hours}h` : "—"}
                    </span>
                  </td>

                  {/* €/ora */}
                  <td className="px-3 py-2 text-right">
                    {prod > 0 ? (
                      <span className={cn("text-[12px] font-semibold", prod >= 40 ? "text-success" : "text-warning")}>
                        €{prod.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50">—</span>
                    )}
                  </td>

                  {/* vs Budget */}
                  <td className="px-3 py-2 text-right">
                    <BudgetPctBadge pct={pct} />
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals */}
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/20">
              <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Totale settimana
              </td>
              <td className="px-3 py-2 text-right text-[12px] font-bold text-foreground">
                €{fmtEur(totals.revenue)}
              </td>
              <td className="px-3 py-2 text-right text-[12px] font-semibold text-muted-foreground">
                €{fmtEur(totals.budget)}
              </td>
              <td className="px-3 py-2 text-right text-[12px] font-semibold text-foreground">
                {totals.covers.toLocaleString("it-IT")}
              </td>
              <td className="px-3 py-2 text-right text-[12px] font-semibold text-muted-foreground">
                {totals.hours}h
              </td>
              <td className="px-3 py-2 text-right">
                {totals.productivity > 0 ? (
                  <span className={cn("text-[12px] font-bold", totals.productivity >= 40 ? "text-success" : "text-warning")}>
                    €{totals.productivity.toFixed(1)}
                  </span>
                ) : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <BudgetPctBadge pct={totals.budgetPct} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border-t border-border px-4 py-2 bg-muted/10">
        <p className="text-[10px] text-muted-foreground">
          Ore staff calcolate automaticamente dai turni pubblicati · €/ora = Incasso ÷ Ore staff · Soglia produttività: €40/h
        </p>
      </div>
    </div>
  );
}
