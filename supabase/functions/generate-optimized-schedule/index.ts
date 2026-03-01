import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmployeeData {
  user_id: string;
  department: "sala" | "cucina";
  weekly_contract_hours: number;
  is_active: boolean;
  first_name?: string;
  last_name?: string;
}

interface EmployeeConstraints {
  user_id: string;
  custom_max_daily_hours: number | null;
  custom_max_weekly_hours: number | null;
  custom_max_split_shifts: number | null;
  custom_days_off: number | null;
}

interface AvailSlot {
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface ExceptionBlock {
  user_id: string;
  start_date: string;
  end_date: string;
}

interface CoverageReq {
  day_of_week: number;
  hour_slot: string;
  department: "sala" | "cucina";
  min_staff_required: number;
}

interface AllowedTime {
  department: "sala" | "cucina";
  kind: "entry" | "exit";
  hour: number;
  is_active: boolean;
}

interface StoreRules {
  max_daily_hours_per_employee: number;
  max_weekly_hours_per_employee: number;
  mandatory_days_off_per_week: number;
  max_split_shifts_per_employee_per_week: number;
  max_daily_team_hours_sala: number;
  max_daily_team_hours_cucina: number;
  max_team_hours_sala_per_week: number;
  max_team_hours_cucina_per_week: number;
}

interface GeneratedShift {
  store_id: string;
  user_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  department: "sala" | "cucina";
  is_day_off: boolean;
  status: "draft";
  generation_run_id: string;
}

interface IterationResult {
  shifts: GeneratedShift[];
  uncoveredSlots: { date: string; hour: string }[];
  fitnessScore: number;
  hourAdjustments: Record<string, number>;
  dayLogs: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseHour(timeStr: string): number {
  const h = parseInt(timeStr.split(":")[0], 10);
  return h === 0 ? 24 : h;
}

function getDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  return (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
}

function getWeekDates(weekStart: string): string[] {
  const dates: string[] = [];
  const start = new Date(weekStart + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(getDateStr(d));
  }
  return dates;
}

/** Check if employee is available on a given date.
 *  - Full-day exceptions block the entire day.
 *  - If employee has NO availability records at all → always available (contract hours).
 *  - If employee HAS availability records → must match day_of_week. */
function isAvailable(emp: string, dateStr: string, availability: AvailSlot[], exceptions: ExceptionBlock[], allEmployeeIds?: Set<string>): boolean {
  for (const ex of exceptions) {
    if (ex.user_id === emp && dateStr >= ex.start_date && dateStr <= ex.end_date) {
      return false;
    }
  }
  // If employee has NO custom schedule → always available
  const hasAnyAvailability = availability.some(a => a.user_id === emp);
  if (!hasAnyAvailability) return true;

  const dow = getDayOfWeek(dateStr);
  return availability.some(a => a.user_id === emp && a.day_of_week === dow);
}

/** Get available hour ranges for an employee on a given date.
 *  If no custom schedule exists → returns a single range covering 0-24 (full day).
 *  The actual shift will be constrained by allowed entry/exit times and opening hours. */
function getAvailableHoursForDay(emp: string, dateStr: string, availability: AvailSlot[]): { start: number; end: number }[] {
  const hasAnyAvailability = availability.some(a => a.user_id === emp);
  if (!hasAnyAvailability) {
    // No custom schedule → available all day, engine will use allowed times & opening hours
    return [{ start: 0, end: 24 }];
  }
  const dow = getDayOfWeek(dateStr);
  return availability
    .filter(a => a.user_id === emp && a.day_of_week === dow)
    .map(a => ({ start: parseHour(a.start_time), end: parseHour(a.end_time) }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Fitness Scoring with Equity ─────────────────────────────────────────────

const PENALTY_UNCOVERED = -100;
const PENALTY_OVERCROWDED = -10;
const PENALTY_DRIFT_PER_H = -5;
const PENALTY_REST_VIOLATION = -200;  // 11h rest violation (HARD)
const PENALTY_NO_DAY_OFF = -500;      // Employee has 0 days off (HARD)
const PENALTY_EQUITY_SPLIT = -30;     // Spezzati equity
const PENALTY_EQUITY_DAYSOFF = -30;   // Days off equity
const BONUS_BALANCED = 3;

function computeFitness(
  shifts: GeneratedShift[],
  uncoveredSlots: { date: string; hour: string }[],
  employees: EmployeeData[],
  coverage: CoverageReq[],
  weekDates: string[],
  hourBalances: Map<string, number>,
  department: "sala" | "cucina",
): { score: number; hourAdjustments: Record<string, number> } {
  let score = 0;
  const deptEmployees = employees.filter(e => e.department === department && e.is_active);
  const deptShifts = shifts.filter(s => s.department === department);

  // 1) Uncovered slots penalty (HARD)
  score += uncoveredSlots.length * PENALTY_UNCOVERED;

  // 2) Overcrowding penalty
  for (const dateStr of weekDates) {
    const dow = getDayOfWeek(dateStr);
    const dayCov = coverage.filter(c => c.day_of_week === dow && c.department === department);
    for (const c of dayCov) {
      const h = parseInt(c.hour_slot.split(":")[0], 10);
      const assigned = deptShifts.filter(s =>
        !s.is_day_off && s.date === dateStr &&
        s.start_time !== null && s.end_time !== null &&
        parseHour(s.start_time!) <= h && parseHour(s.end_time!) > h
      ).length;
      if (assigned > c.min_staff_required) {
        score += (assigned - c.min_staff_required) * PENALTY_OVERCROWDED;
      }
    }
  }

  // 3) 11h rest rule violations (HARD)
  for (const emp of deptEmployees) {
    const empShifts = deptShifts
      .filter(s => s.user_id === emp.user_id && !s.is_day_off && s.start_time && s.end_time)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return parseHour(a.start_time!) - parseHour(b.start_time!);
      });

    for (let i = 0; i < empShifts.length - 1; i++) {
      const endH = parseHour(empShifts[i].end_time!);
      const nextStartH = parseHour(empShifts[i + 1].start_time!);

      let restHours: number;
      if (empShifts[i].date === empShifts[i + 1].date) {
        // Same day: this is a split shift, rest = gap between shifts
        restHours = nextStartH - endH;
      } else {
        // Different days: rest = (24 - endH) + nextStartH
        restHours = (24 - endH) + nextStartH;
      }

      if (restHours < 11 && empShifts[i].date !== empShifts[i + 1].date) {
        score += PENALTY_REST_VIOLATION;
      }
    }
  }

  // 4) Contractual drift penalty
  const hourAdjustments: Record<string, number> = {};
  const weeklyHoursMap = new Map<string, number>();
  for (const s of deptShifts) {
    if (s.is_day_off || !s.start_time || !s.end_time) continue;
    const dur = parseHour(s.end_time) - parseHour(s.start_time);
    weeklyHoursMap.set(s.user_id, (weeklyHoursMap.get(s.user_id) ?? 0) + dur);
  }

  for (const emp of deptEmployees) {
    const assigned = weeklyHoursMap.get(emp.user_id) ?? 0;
    const balance = hourBalances.get(emp.user_id) ?? 0;
    const target = emp.weekly_contract_hours - balance;
    const delta = assigned - target;
    hourAdjustments[emp.user_id] = delta;

    if (Math.abs(delta) > 5) {
      score += (Math.abs(delta) - 5) * PENALTY_DRIFT_PER_H;
    }
    if (Math.abs(delta) <= 2) {
      score += BONUS_BALANCED;
    }
  }

  // 5) EQUITY: penalize split shift imbalance (soft)
  const splitCounts = new Map<string, number>();
  for (const emp of deptEmployees) {
    const empDayShifts = new Map<string, number>();
    for (const s of deptShifts) {
      if (s.user_id === emp.user_id && !s.is_day_off && s.start_time) {
        empDayShifts.set(s.date, (empDayShifts.get(s.date) ?? 0) + 1);
      }
    }
    let splits = 0;
    for (const [, count] of empDayShifts) {
      if (count > 1) splits += count - 1;
    }
    splitCounts.set(emp.user_id, splits);
  }

  if (deptEmployees.length > 1) {
    const splitValues = [...splitCounts.values()];
    const maxSplit = Math.max(...splitValues);
    const minSplit = Math.min(...splitValues);
    if (maxSplit - minSplit > 1) {
      score += (maxSplit - minSplit - 1) * PENALTY_EQUITY_SPLIT;
    }
  }

  // 6) EQUITY: penalize days off imbalance (soft) + HARD penalty for 0 days off
  const daysOffCounts = new Map<string, number>();
  for (const emp of deptEmployees) {
    // Count days off = days where employee has a day_off shift OR simply doesn't work
    const workDays = new Set(deptShifts.filter(s => s.user_id === emp.user_id && !s.is_day_off && s.start_time).map(s => s.date));
    const offCount = weekDates.length - workDays.size;
    daysOffCounts.set(emp.user_id, offCount);
    // HARD penalty: if employee has 0 days off, massive penalty
    if (offCount === 0) {
      score += PENALTY_NO_DAY_OFF;
    }
  }

  if (deptEmployees.length > 1) {
    const offValues = [...daysOffCounts.values()];
    const maxOff = Math.max(...offValues);
    const minOff = Math.min(...offValues);
    if (maxOff - minOff > 1) {
      score += (maxOff - minOff - 1) * PENALTY_EQUITY_DAYSOFF;
    }
  }

  return { score, hourAdjustments };
}
/** Remove blocked time ranges from availability (for partial-day requests like mattina_libera / sera_libera) */
function applyPartialBlocks(
  avail: { start: number; end: number }[],
  blocks: { blockedStart: number; blockedEnd: number }[],
): { start: number; end: number }[] {
  let result = [...avail];
  for (const block of blocks) {
    const next: { start: number; end: number }[] = [];
    for (const range of result) {
      // No overlap
      if (range.end <= block.blockedStart || range.start >= block.blockedEnd) {
        next.push(range);
        continue;
      }
      // Left portion
      if (range.start < block.blockedStart) {
        next.push({ start: range.start, end: block.blockedStart });
      }
      // Right portion
      if (range.end > block.blockedEnd) {
        next.push({ start: block.blockedEnd, end: range.end });
      }
    }
    result = next;
  }
  return result.filter(r => r.end - r.start >= 1); // At least 1h slot
}

// ─── AI Strategy Types & Functions ───────────────────────────────────────────

interface AIStrategy {
  maxSplits: number;
  preferShort: boolean;
  randomize: boolean;
  reserveForSplit: number;
  description: string;
}

function getDefaultStrategies(): AIStrategy[] {
  const strategies: AIStrategy[] = [];
  let id = 0;
  for (const maxSplits of [0, 1, 2, 3]) {
    for (const preferShort of [true, false]) {
      for (const reserve of [0, 2, 3]) {
        for (const randomize of [true, false]) {
          strategies.push({
            maxSplits,
            preferShort,
            randomize,
            reserveForSplit: maxSplits > 0 && preferShort ? reserve : 0,
            description: `default-${id++}`,
          });
          if (strategies.length >= 40) return strategies;
        }
      }
    }
  }
  return strategies;
}

async function generateAIStrategies(context: {
  rules: StoreRules;
  employees: { user_id: string; department: string; weekly_contract_hours: number; first_name?: string; last_name?: string }[];
  coverageSummary: string;
  department: string;
  smartMemorySummary: string;
  totalCoverageHours: number;
  totalEmployeeHours: number;
  openingHours: { day_of_week: number; opening_time: string; closing_time: string }[];
  allowedTimes: AllowedTime[];
  coverageDetails: { day_of_week: number; hour_slot: string; min_staff_required: number }[];
  employeeConstraints: { user_id: string; custom_max_daily_hours: number | null; custom_max_weekly_hours: number | null; custom_max_split_shifts: number | null; custom_days_off: number | null }[];
  availability: { user_id: string; day_of_week: number; start_time: string; end_time: string }[];
  exceptions: { user_id: string; start_date: string; end_date: string }[];
  approvedRequests: { user_id: string; request_date: string; request_type: string; selected_hour: number | null }[];
  hourBalances: Record<string, number>;
}): Promise<{ strategies: AIStrategy[]; aiUsed: boolean }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("GEMINI_AI_REQUIRED: LOVABLE_API_KEY non configurata. Impossibile generare turni senza Gemini 2.5 AI. Configura la chiave nelle impostazioni del progetto.");
  }

  const ratio = (context.totalCoverageHours / Math.max(context.totalEmployeeHours, 1)).toFixed(2);

  // Build comprehensive JSON payload for Gemini
  const storeSettingsJSON = {
    regole_store: {
      max_ore_giornaliere_dipendente: context.rules.max_daily_hours_per_employee,
      max_ore_settimanali_dipendente: context.rules.max_weekly_hours_per_employee,
      giorni_liberi_obbligatori: context.rules.mandatory_days_off_per_week,
      max_spezzati_settimana: context.rules.max_split_shifts_per_employee_per_week,
      max_ore_team_sala_giorno: context.rules.max_daily_team_hours_sala,
      max_ore_team_cucina_giorno: context.rules.max_daily_team_hours_cucina,
      max_ore_team_sala_settimana: context.rules.max_team_hours_sala_per_week,
      max_ore_team_cucina_settimana: context.rules.max_team_hours_cucina_per_week,
    },
    orari_apertura: context.openingHours.map(h => ({
      giorno: h.day_of_week,
      apertura: h.opening_time,
      chiusura: h.closing_time,
    })),
    entrate_uscite_ammesse: context.allowedTimes
      .filter(t => t.department === context.department && t.is_active)
      .map(t => ({ tipo: t.kind, ora: t.hour })),
    copertura_richiesta: context.coverageDetails.map(c => ({
      giorno: c.day_of_week,
      ora: c.hour_slot,
      staff_minimo: c.min_staff_required,
    })),
    dipendenti: context.employees.map(e => {
      const ec = context.employeeConstraints.find(c => c.user_id === e.user_id);
      const avail = context.availability.filter(a => a.user_id === e.user_id);
      const excs = context.exceptions.filter(x => x.user_id === e.user_id);
      const reqs = context.approvedRequests.filter(r => r.user_id === e.user_id);
      const balance = context.hourBalances[e.user_id] ?? 0;
      return {
        id: e.user_id.slice(0, 8),
        nome: e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : e.user_id.slice(0, 8),
        reparto: e.department,
        ore_contrattuali: e.weekly_contract_hours,
        bilancio_ore: balance,
        ore_target: e.weekly_contract_hours - balance,
        vincoli_personalizzati: ec ? {
          max_ore_giornaliere: ec.custom_max_daily_hours,
          max_ore_settimanali: ec.custom_max_weekly_hours,
          max_spezzati: ec.custom_max_split_shifts,
          giorni_liberi: ec.custom_days_off,
        } : null,
        disponibilita: avail.length > 0 ? avail.map(a => ({
          giorno: a.day_of_week,
          da: a.start_time,
          a: a.end_time,
        })) : "sempre_disponibile",
        eccezioni: excs.length > 0 ? excs.map(x => ({
          da: x.start_date,
          a: x.end_date,
        })) : [],
        richieste_approvate: reqs.length > 0 ? reqs.map(r => ({
          data: r.request_date,
          tipo: r.request_type,
          ora_selezionata: r.selected_hour,
        })) : [],
      };
    }),
    metriche: {
      ore_copertura_totali: context.totalCoverageHours,
      ore_disponibili_totali: context.totalEmployeeHours,
      rapporto: parseFloat(ratio),
    },
  };

  const systemPrompt = `Sei un esperto di pianificazione turni per ristoranti italiani. Genera ESATTAMENTE 40 strategie DIVERSE per la generazione automatica degli orari settimanali.

DATI COMPLETI DELLO STORE E DEI DIPENDENTI (JSON):
${JSON.stringify(storeSettingsJSON, null, 1)}

Ogni strategia controlla l'algoritmo di generazione:
- maxSplits (0-3): max turni spezzati per dipendente a settimana
- preferShort (bool): turni corti per lasciare spazio a spezzati
- randomize (bool): ordine dipendenti casuale vs fill-ratio
- reserveForSplit (0-4): ore riservate nel primo turno per spezzato serale
- description: breve (max 30 char)

REGOLE INVIOLABILI:
- Rispetta AL 100% orari apertura/chiusura di ogni giorno
- Rispetta entrate/uscite ammesse per il reparto ${context.department}
- Ogni dipendente non può superare le ore giornaliere/settimanali (personalizzate o di store)
- Ogni dipendente DEVE avere almeno ${context.rules.mandatory_days_off_per_week} giorno/i libero/i
- Le eccezioni (ferie, malattia) bloccano COMPLETAMENTE il dipendente in quelle date
- Le richieste approvate DEVONO essere rispettate
- Il bilancio ore deve guidare la distribuzione: chi ha ore in eccesso riceve meno

DISTRIBUZIONE STRATEGIE:
- Almeno 10 strategie con maxSplits=0 (turni pieni, niente spezzati)
- Almeno 5 con maxSplits=1 (spezzati minimi)
- Almeno 10 con maxSplits>=2 (spezzati equilibrati)
- Almeno 5 con 2 giorni liberi garantiti per tutti
- Almeno 5 con randomize=true per esplorazione
- Se rapporto copertura/disponibilità >0.8: privilegia più spezzati
- Se <0.5: privilegia turni lunghi e continui

${context.smartMemorySummary}`;

  const userPrompt = `Reparto: ${context.department}
Dipendenti: ${context.employees.length} (${context.employees.map(e => `${e.first_name ?? e.user_id.slice(0,6)}: ${e.weekly_contract_hours}h`).join(', ')})
Rapporto copertura: ${ratio}

Genera ESATTAMENTE 40 strategie diverse ottimizzate per questo specifico store.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "submit_strategies",
          description: "Submit 40 diverse scheduling strategies",
          parameters: {
            type: "object",
            properties: {
              strategies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    maxSplits: { type: "number" },
                    preferShort: { type: "boolean" },
                    randomize: { type: "boolean" },
                    reserveForSplit: { type: "number" },
                    description: { type: "string" },
                  },
                  required: ["maxSplits", "preferShort", "randomize", "reserveForSplit", "description"],
                },
              },
            },
            required: ["strategies"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "submit_strategies" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[AI] Gemini error ${response.status}: ${errText}`);
    if (response.status === 429) {
      throw new Error("GEMINI_AI_REQUIRED: Gemini 2.5 AI ha raggiunto il limite di richieste. Riprova tra qualche minuto.");
    }
    if (response.status === 402) {
      throw new Error("GEMINI_AI_REQUIRED: Crediti Lovable AI esauriti. Aggiungi crediti in Settings → Workspace → Usage e riprova.");
    }
    throw new Error(`GEMINI_AI_REQUIRED: Gemini 2.5 AI non disponibile (HTTP ${response.status}). Riprova o controlla la configurazione.`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("GEMINI_AI_REQUIRED: Gemini 2.5 AI non ha restituito strategie valide. Riprova la generazione.");
  }

  const args = JSON.parse(toolCall.function.arguments);
  const strategies: AIStrategy[] = (args.strategies ?? []).map((s: any) => ({
    maxSplits: Math.min(3, Math.max(0, Number(s.maxSplits) || 0)),
    preferShort: Boolean(s.preferShort),
    randomize: Boolean(s.randomize),
    reserveForSplit: Math.min(4, Math.max(0, Number(s.reserveForSplit) || 0)),
    description: String(s.description ?? "").slice(0, 50),
  }));

  if (strategies.length === 0) {
    throw new Error("GEMINI_AI_REQUIRED: Gemini 2.5 AI ha restituito 0 strategie. Riprova la generazione.");
  }

  console.log(`[AI] Gemini 2.5 generated ${strategies.length} strategies with full store context`);

  // Pad to 40 with variations of existing AI strategies if needed
  while (strategies.length < 40) {
    const base = strategies[strategies.length % strategies.length];
    strategies.push({
      ...base,
      randomize: !base.randomize,
      description: `${base.description}-v${strategies.length}`,
    });
  }

  return { strategies: strategies.slice(0, 40), aiUsed: true };
}

function postValidateShifts(
  shifts: GeneratedShift[],
  employees: EmployeeData[],
  rules: StoreRules,
  empConstraints: Map<string, EmployeeConstraints>,
  department: "sala" | "cucina",
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const deptShifts = shifts.filter(s => s.department === department);
  const deptEmployees = employees.filter(e => e.department === department && e.is_active);

  for (const emp of deptEmployees) {
    const empShifts = deptShifts.filter(s => s.user_id === emp.user_id && !s.is_day_off && s.start_time && s.end_time);
    const ec = empConstraints.get(emp.user_id);

    // Weekly hours
    const weeklyH = empShifts.reduce((sum, s) => sum + (parseHour(s.end_time!) - parseHour(s.start_time!)), 0);
    const maxWeekly = ec?.custom_max_weekly_hours ?? rules.max_weekly_hours_per_employee;
    if (weeklyH > maxWeekly) violations.push(`${emp.user_id}: ${weeklyH}h > max ${maxWeekly}h/sett`);

    // Daily hours
    const byDate = new Map<string, typeof empShifts>();
    for (const s of empShifts) {
      const arr = byDate.get(s.date) ?? [];
      arr.push(s);
      byDate.set(s.date, arr);
    }
    const maxDaily = ec?.custom_max_daily_hours ?? rules.max_daily_hours_per_employee;
    for (const [date, dayShifts] of byDate) {
      const dailyH = dayShifts.reduce((sum, s) => sum + (parseHour(s.end_time!) - parseHour(s.start_time!)), 0);
      if (dailyH > maxDaily) violations.push(`${emp.user_id} ${date}: ${dailyH}h > max ${maxDaily}h/giorno`);
    }

    // Weekly splits
    let weeklySplits = 0;
    for (const [, dayShifts] of byDate) {
      if (dayShifts.length > 1) weeklySplits += dayShifts.length - 1;
    }
    const maxSplitsWeek = ec?.custom_max_split_shifts ?? rules.max_split_shifts_per_employee_per_week;
    if (weeklySplits > maxSplitsWeek) violations.push(`${emp.user_id}: ${weeklySplits} spezzati > max ${maxSplitsWeek}/sett`);

    // Days off
    const daysWorked = byDate.size;
    const minDaysOff = ec?.custom_days_off ?? rules.mandatory_days_off_per_week;
    if (7 - daysWorked < minDaysOff) violations.push(`${emp.user_id}: ${7 - daysWorked} giorni liberi < min ${minDaysOff}`);

    // 11h rest between days
    const sorted = empShifts.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return parseHour(a.start_time!) - parseHour(b.start_time!);
    });
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].date !== sorted[i + 1].date) {
        const endH = parseHour(sorted[i].end_time!);
        const nextStartH = parseHour(sorted[i + 1].start_time!);
        const rest = (24 - endH) + nextStartH;
        if (rest < 11) violations.push(`${emp.user_id}: ${rest}h riposo < 11h tra ${sorted[i].date} e ${sorted[i + 1].date}`);
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// ─── Auto-Correction of Violations ───────────────────────────────────────────

function autoCorrectViolations(
  shifts: GeneratedShift[],
  employees: EmployeeData[],
  rules: StoreRules,
  empConstraints: Map<string, EmployeeConstraints>,
  department: "sala" | "cucina",
  coverage: CoverageReq[],
  weekDates: string[],
): { correctedShifts: GeneratedShift[]; corrections: string[] } {
  const allCorrections: string[] = [];
  let corrected = [...shifts];
  const deptEmployees = employees.filter(e => e.department === department && e.is_active);
  const MAX_CORRECTION_PASSES = 5;

  for (let pass = 0; pass < MAX_CORRECTION_PASSES; pass++) {
    const passCorrections: string[] = [];

    for (const emp of deptEmployees) {
      const ec = empConstraints.get(emp.user_id);
      const maxDaily = ec?.custom_max_daily_hours ?? rules.max_daily_hours_per_employee;
      const maxWeekly = ec?.custom_max_weekly_hours ?? rules.max_weekly_hours_per_employee;
      const maxSplitsWeek = ec?.custom_max_split_shifts ?? rules.max_split_shifts_per_employee_per_week;
      const minDaysOff = ec?.custom_days_off ?? rules.mandatory_days_off_per_week;

      const empShifts = () => corrected.filter(s => s.user_id === emp.user_id && s.department === department && !s.is_day_off && s.start_time && s.end_time);

      // 1) Fix excessive daily hours: shorten the longest shift on that day
      const byDate = new Map<string, GeneratedShift[]>();
      for (const s of empShifts()) {
        const arr = byDate.get(s.date) ?? [];
        arr.push(s);
        byDate.set(s.date, arr);
      }
      for (const [date, dayShifts] of byDate) {
        const dailyH = dayShifts.reduce((sum, s) => sum + (parseHour(s.end_time!) - parseHour(s.start_time!)), 0);
        if (dailyH > maxDaily) {
          const excess = dailyH - maxDaily;
          const longest = dayShifts.sort((a, b) => (parseHour(b.end_time!) - parseHour(b.start_time!)) - (parseHour(a.end_time!) - parseHour(a.start_time!)))[0];
          const endH = parseHour(longest.end_time!);
          const newEnd = endH - excess;
          if (newEnd > parseHour(longest.start_time!)) {
            const idx = corrected.indexOf(longest);
            if (idx >= 0) {
              corrected[idx] = { ...longest, end_time: `${String(newEnd === 24 ? 0 : newEnd).padStart(2, "0")}:00` };
              passCorrections.push(`FIX ore giornaliere [pass ${pass+1}]: ${emp.user_id.slice(0,8)} ${date} accorciato di ${excess}h`);
            }
          }
        }
      }

      // 2) Fix excessive weekly hours: remove shifts from lowest-demand days
      const weeklyH = empShifts().reduce((sum, s) => sum + (parseHour(s.end_time!) - parseHour(s.start_time!)), 0);
      if (weeklyH > maxWeekly) {
        let excess = weeklyH - maxWeekly;
        const sortedByDemand = empShifts().sort((a, b) => {
          const aDow = getDayOfWeek(a.date);
          const bDow = getDayOfWeek(b.date);
          const aDemand = coverage.filter(c => c.day_of_week === aDow && c.department === department).reduce((s, c) => s + c.min_staff_required, 0);
          const bDemand = coverage.filter(c => c.day_of_week === bDow && c.department === department).reduce((s, c) => s + c.min_staff_required, 0);
          return aDemand - bDemand;
        });
        for (const shift of sortedByDemand) {
          if (excess <= 0) break;
          const dur = parseHour(shift.end_time!) - parseHour(shift.start_time!);
          corrected = corrected.filter(s => s !== shift);
          corrected.push({ ...shift, start_time: null, end_time: null, is_day_off: true });
          excess -= dur;
          passCorrections.push(`FIX ore settimanali [pass ${pass+1}]: ${emp.user_id.slice(0,8)} rimosso turno ${shift.date} (${dur}h)`);
        }
      }

      // 3) Fix excessive weekly splits: remove splits from lowest-demand days
      const dateShiftCounts = new Map<string, number>();
      for (const s of empShifts()) {
        dateShiftCounts.set(s.date, (dateShiftCounts.get(s.date) ?? 0) + 1);
      }
      let weeklySplitCount = 0;
      for (const [, count] of dateShiftCounts) {
        if (count > 1) weeklySplitCount += count - 1;
      }
      if (weeklySplitCount > maxSplitsWeek) {
        const splitDays = [...dateShiftCounts.entries()]
          .filter(([, c]) => c > 1)
          .sort((a, b) => {
            const aDow = getDayOfWeek(a[0]);
            const bDow = getDayOfWeek(b[0]);
            const aDemand = coverage.filter(c => c.day_of_week === aDow && c.department === department).reduce((s, c) => s + c.min_staff_required, 0);
            const bDemand = coverage.filter(c => c.day_of_week === bDow && c.department === department).reduce((s, c) => s + c.min_staff_required, 0);
            return aDemand - bDemand;
          });
        for (const [date] of splitDays) {
          if (weeklySplitCount <= maxSplitsWeek) break;
          const dayShifts = empShifts().filter(s => s.date === date).sort((a, b) =>
            (parseHour(a.end_time!) - parseHour(a.start_time!)) - (parseHour(b.end_time!) - parseHour(b.start_time!))
          );
          if (dayShifts.length > 1) {
            corrected = corrected.filter(s => s !== dayShifts[0]);
            weeklySplitCount--;
            passCorrections.push(`FIX spezzati [pass ${pass+1}]: ${emp.user_id.slice(0,8)} rimosso spezzato ${date}`);
          }
        }
      }

      // 4) Fix insufficient days off: remove all shifts on lowest-demand day
      const workedDates = new Set(empShifts().map(s => s.date));
      const daysOff = 7 - workedDates.size;
      if (daysOff < minDaysOff) {
        const needMore = minDaysOff - daysOff;
        const sortedWorked = [...workedDates].sort((a, b) => {
          const aDow = getDayOfWeek(a);
          const bDow = getDayOfWeek(b);
          const aDemand = coverage.filter(c => c.day_of_week === aDow && c.department === department).reduce((s, c) => s + c.min_staff_required, 0);
          const bDemand = coverage.filter(c => c.day_of_week === bDow && c.department === department).reduce((s, c) => s + c.min_staff_required, 0);
          return aDemand - bDemand;
        });
        for (let i = 0; i < needMore && i < sortedWorked.length; i++) {
          const date = sortedWorked[i];
          const removed = corrected.filter(s => s.user_id === emp.user_id && s.department === department && s.date === date && !s.is_day_off);
          corrected = corrected.filter(s => !removed.includes(s));
          corrected.push({
            store_id: removed[0]?.store_id ?? "",
            user_id: emp.user_id,
            date,
            start_time: null,
            end_time: null,
            department,
            is_day_off: true,
            status: "draft",
            generation_run_id: removed[0]?.generation_run_id ?? "",
          });
          passCorrections.push(`FIX giorni liberi [pass ${pass+1}]: ${emp.user_id.slice(0,8)} giorno libero forzato ${date}`);
        }
      }

      // 5) Fix 11h rest violations: postpone next day's start
      const allEmpShifts = empShifts().sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return parseHour(a.start_time!) - parseHour(b.start_time!);
      });
      for (let i = 0; i < allEmpShifts.length - 1; i++) {
        if (allEmpShifts[i].date !== allEmpShifts[i + 1].date) {
          const endH = parseHour(allEmpShifts[i].end_time!);
          const nextStartH = parseHour(allEmpShifts[i + 1].start_time!);
          const rest = (24 - endH) + nextStartH;
          if (rest < 11) {
            const needed = 11 - rest;
            const newStart = nextStartH + needed;
            const idx = corrected.indexOf(allEmpShifts[i + 1]);
            if (idx >= 0 && newStart < parseHour(corrected[idx].end_time!)) {
              corrected[idx] = { ...corrected[idx], start_time: `${String(newStart).padStart(2, "0")}:00` };
              passCorrections.push(`FIX riposo 11h [pass ${pass+1}]: ${emp.user_id.slice(0,8)} ${allEmpShifts[i + 1].date} posticipato ingresso a ${newStart}:00`);
            }
          }
        }
      }
    }

    allCorrections.push(...passCorrections);

    // If no corrections were needed in this pass, we're done
    if (passCorrections.length === 0) break;
  }

  return { correctedShifts: corrected, corrections: allCorrections };
}

// ─── Equity Rebalancing Pass ─────────────────────────────────────────────────

function equalizeEquity(
  shifts: GeneratedShift[],
  employees: EmployeeData[],
  rules: StoreRules,
  empConstraints: Map<string, EmployeeConstraints>,
  department: "sala" | "cucina",
  coverage: CoverageReq[],
  weekDates: string[],
  availability: AvailSlot[],
  exceptions: ExceptionBlock[],
  allowedTimes: AllowedTime[],
  openingHours: { day_of_week: number; opening_time: string; closing_time: string }[],
): { rebalancedShifts: GeneratedShift[]; equityReport: string[] } {
  let result = [...shifts];
  const equityReport: string[] = [];
  const deptEmployees = employees.filter(e => e.department === department && e.is_active);
  if (deptEmployees.length < 2) return { rebalancedShifts: result, equityReport };

  const empNameMap = new Map(employees.map(e => [e.user_id, `${(e as any).first_name ?? ""} ${(e as any).last_name ?? ""}`.trim() || e.user_id.slice(0, 8)]));
  const getEmpName = (uid: string) => empNameMap.get(uid) ?? uid.slice(0, 8);

  // Helper: count days off and splits for current state
  function computeStats(s: GeneratedShift[]) {
    const daysOffMap = new Map<string, number>();
    const splitsMap = new Map<string, number>();
    const hoursMap = new Map<string, number>();
    for (const emp of deptEmployees) {
      const workDays = new Set(s.filter(sh => sh.user_id === emp.user_id && sh.department === department && !sh.is_day_off && sh.start_time).map(sh => sh.date));
      daysOffMap.set(emp.user_id, weekDates.length - workDays.size);
      let splitCount = 0;
      const byDate = new Map<string, number>();
      for (const sh of s.filter(sh => sh.user_id === emp.user_id && sh.department === department && !sh.is_day_off && sh.start_time)) {
        byDate.set(sh.date, (byDate.get(sh.date) ?? 0) + 1);
      }
      for (const [, c] of byDate) { if (c > 1) splitCount += c - 1; }
      splitsMap.set(emp.user_id, splitCount);
      let hours = 0;
      for (const sh of s.filter(sh => sh.user_id === emp.user_id && sh.department === department && !sh.is_day_off && sh.start_time && sh.end_time)) {
        hours += parseHour(sh.end_time!) - parseHour(sh.start_time!);
      }
      hoursMap.set(emp.user_id, hours);
    }
    return { daysOffMap, splitsMap, hoursMap };
  }

  // Helper: get day demand
  function getDayDemand(dateStr: string): number {
    const dow = getDayOfWeek(dateStr);
    return coverage.filter(c => c.day_of_week === dow && c.department === department).reduce((s, c) => s + c.min_staff_required, 0);
  }

  // ── 1) EQUALIZE DAYS OFF ──
  // Target: all employees should have the same number of days off if possible
  const MAX_EQUITY_PASSES = 3;
  for (let pass = 0; pass < MAX_EQUITY_PASSES; pass++) {
    const stats = computeStats(result);
    const offValues = [...stats.daysOffMap.values()];
    const avgOff = offValues.reduce((a, b) => a + b, 0) / offValues.length;
    const targetOff = Math.round(avgOff);
    const maxOff = Math.max(...offValues);
    const minOff = Math.min(...offValues);
    if (maxOff - minOff <= 1) break; // Already balanced enough

    // Find employees with too many days off (donors) and too few (receivers)
    const donors = deptEmployees.filter(e => (stats.daysOffMap.get(e.user_id) ?? 0) > targetOff)
      .sort((a, b) => (stats.daysOffMap.get(b.user_id) ?? 0) - (stats.daysOffMap.get(a.user_id) ?? 0));
    const receivers = deptEmployees.filter(e => (stats.daysOffMap.get(e.user_id) ?? 0) < targetOff)
      .sort((a, b) => (stats.daysOffMap.get(a.user_id) ?? 0) - (stats.daysOffMap.get(b.user_id) ?? 0));

    let swapped = false;
    for (const donor of donors) {
      if ((stats.daysOffMap.get(donor.user_id) ?? 0) <= targetOff) continue;
      for (const receiver of receivers) {
        if ((stats.daysOffMap.get(receiver.user_id) ?? 0) >= targetOff) continue;
        // Find a day where donor is off and receiver works, and swap is safe
        const donorOffDays = weekDates.filter(d => {
          const works = result.some(s => s.user_id === donor.user_id && s.department === department && s.date === d && !s.is_day_off && s.start_time);
          return !works;
        });
        const receiverWorkDays = weekDates.filter(d => {
          const works = result.some(s => s.user_id === receiver.user_id && s.department === department && s.date === d && !s.is_day_off && s.start_time);
          return works;
        });

        // Sort by demand (swap on lowest demand days)
        donorOffDays.sort((a, b) => getDayDemand(a) - getDayDemand(b));

        for (const swapDay of donorOffDays) {
          // Check: can donor work on swapDay?
          if (!isAvailable(donor.user_id, swapDay, availability, exceptions)) continue;
          const ec = empConstraints.get(donor.user_id);
          const maxWeekly = ec?.custom_max_weekly_hours ?? rules.max_weekly_hours_per_employee;
          if ((stats.hoursMap.get(donor.user_id) ?? 0) >= maxWeekly) continue;

          // Find a day where receiver works that has low demand to give as day off
          for (const offDay of receiverWorkDays) {
            if (offDay === swapDay) continue;
            const receiverEc = empConstraints.get(receiver.user_id);
            const minDaysOff = receiverEc?.custom_days_off ?? rules.mandatory_days_off_per_week;
            // Receiver must still have minimum days off after gaining this one
            // (they're getting +1 so it's fine if they were below target)

            // Check: would removing receiver's shift on offDay hurt coverage?
            const dow = getDayOfWeek(offDay);
            const dayCov = coverage.filter(c => c.day_of_week === dow && c.department === department);
            const dayShifts = result.filter(s => s.date === offDay && s.department === department && !s.is_day_off && s.start_time && s.end_time);
            let wouldUncoverAny = false;
            for (const c of dayCov) {
              const h = parseInt(c.hour_slot.split(":")[0], 10);
              const staffAtH = dayShifts.filter(s => parseHour(s.start_time!) <= h && parseHour(s.end_time!) > h).length;
              const receiverCoversH = dayShifts.filter(s => s.user_id === receiver.user_id && parseHour(s.start_time!) <= h && parseHour(s.end_time!) > h).length;
              if (staffAtH - receiverCoversH < c.min_staff_required) { wouldUncoverAny = true; break; }
            }
            if (wouldUncoverAny) continue;

            // SWAP: donor gets a shift on swapDay (copy receiver's typical hours), receiver gets day off on offDay
            // Remove receiver's shifts on offDay
            const removedShifts = result.filter(s => s.user_id === receiver.user_id && s.department === department && s.date === offDay && !s.is_day_off);
            result = result.filter(s => !removedShifts.includes(s));
            result.push({
              store_id: removedShifts[0]?.store_id ?? "",
              user_id: receiver.user_id,
              date: offDay,
              start_time: null, end_time: null,
              department, is_day_off: true, status: "draft",
              generation_run_id: removedShifts[0]?.generation_run_id ?? "",
            });

            // Add donor shift on swapDay (use a reasonable template from existing shifts)
            const donorExistingShift = result.find(s => s.user_id === donor.user_id && s.department === department && !s.is_day_off && s.start_time && s.end_time);
            if (donorExistingShift) {
              // Remove donor's day off marker on swapDay if exists
              result = result.filter(s => !(s.user_id === donor.user_id && s.department === department && s.date === swapDay && s.is_day_off));
              result.push({
                store_id: donorExistingShift.store_id,
                user_id: donor.user_id,
                date: swapDay,
                start_time: donorExistingShift.start_time,
                end_time: donorExistingShift.end_time,
                department, is_day_off: false, status: "draft",
                generation_run_id: donorExistingShift.generation_run_id,
              });
            }

            equityReport.push(`SWAP riposo: ${getEmpName(receiver.user_id)} riposa ${offDay} (era al lavoro), ${getEmpName(donor.user_id)} lavora ${swapDay} (era in riposo)`);
            swapped = true;
            break;
          }
          if (swapped) break;
        }
        if (swapped) break;
      }
      if (swapped) break;
    }
    if (!swapped) break;
  }

  // ── 2) EQUALIZE SPLIT SHIFTS ──
  // If some employees have many more splits than others, try to swap
  for (let pass = 0; pass < MAX_EQUITY_PASSES; pass++) {
    const stats = computeStats(result);
    const splitValues = [...stats.splitsMap.values()];
    const maxSplits = Math.max(...splitValues);
    const minSplits = Math.min(...splitValues);
    if (maxSplits - minSplits <= 1) break;

    const overloaded = deptEmployees.filter(e => (stats.splitsMap.get(e.user_id) ?? 0) > minSplits + 1)
      .sort((a, b) => (stats.splitsMap.get(b.user_id) ?? 0) - (stats.splitsMap.get(a.user_id) ?? 0));

    let swapped = false;
    for (const emp of overloaded) {
      // Find a day where this employee has a split and remove the shorter segment
      const empShifts = result.filter(s => s.user_id === emp.user_id && s.department === department && !s.is_day_off && s.start_time && s.end_time);
      const byDate = new Map<string, typeof empShifts>();
      for (const s of empShifts) {
        const arr = byDate.get(s.date) ?? [];
        arr.push(s);
        byDate.set(s.date, arr);
      }
      for (const [date, dayShifts] of byDate) {
        if (dayShifts.length <= 1) continue;
        // Remove shortest segment
        dayShifts.sort((a, b) => (parseHour(a.end_time!) - parseHour(a.start_time!)) - (parseHour(b.end_time!) - parseHour(b.start_time!)));
        const toRemove = dayShifts[0];
        result = result.filter(s => s !== toRemove);
        equityReport.push(`RIDUZIONE spezzati: ${getEmpName(emp.user_id)} rimosso spezzato ${date} (${toRemove.start_time}-${toRemove.end_time})`);
        swapped = true;
        break;
      }
      if (swapped) break;
    }
    if (!swapped) break;
  }

  // ── 3) GENERATE EQUITY REPORT ──
  const finalStats = computeStats(result);
  equityReport.push(`\n📊 RIEPILOGO EQUITÀ:`);
  const offValues = [...finalStats.daysOffMap.entries()].map(([uid, v]) => ({ name: getEmpName(uid), value: v }));
  const splitValues = [...finalStats.splitsMap.entries()].map(([uid, v]) => ({ name: getEmpName(uid), value: v }));
  const hoursValues = [...finalStats.hoursMap.entries()].map(([uid, v]) => ({ name: getEmpName(uid), value: v }));

  const avgOff = offValues.reduce((a, b) => a + b.value, 0) / Math.max(offValues.length, 1);
  const avgSplits = splitValues.reduce((a, b) => a + b.value, 0) / Math.max(splitValues.length, 1);
  const avgHours = hoursValues.reduce((a, b) => a + b.value, 0) / Math.max(hoursValues.length, 1);

  equityReport.push(`Media riposi: ${avgOff.toFixed(1)} | Media spezzati: ${avgSplits.toFixed(1)} | Media ore: ${avgHours.toFixed(1)}`);

  for (const emp of deptEmployees) {
    const off = finalStats.daysOffMap.get(emp.user_id) ?? 0;
    const splits = finalStats.splitsMap.get(emp.user_id) ?? 0;
    const hours = finalStats.hoursMap.get(emp.user_id) ?? 0;
    const offDelta = off - avgOff;
    const splitDelta = splits - avgSplits;
    const hourDelta = hours - avgHours;
    const flags: string[] = [];
    if (Math.abs(offDelta) >= 1) flags.push(`riposi ${offDelta > 0 ? "+" : ""}${offDelta.toFixed(0)} vs media`);
    if (Math.abs(splitDelta) >= 1) flags.push(`spezzati ${splitDelta > 0 ? "+" : ""}${splitDelta.toFixed(0)} vs media`);
    if (Math.abs(hourDelta) >= 3) flags.push(`ore ${hourDelta > 0 ? "+" : ""}${hourDelta.toFixed(0)}h vs media`);
    const status = flags.length === 0 ? "✅" : `⚠️ ${flags.join(", ")}`;
    equityReport.push(`  ${getEmpName(emp.user_id)}: ${off} riposi, ${splits} spezzati, ${hours}h — ${status}`);
  }

  return { rebalancedShifts: result, equityReport };
}

// ─── Single Iteration Generator ──────────────────────────────────────────────

// Smart memory score map: key = `${userId}-${dow}-${hour}` -> score (positive = good, negative = bad)
type SmartMemoryScores = Map<string, number>;

function getSmartMemoryKey(userId: string, dow: number, hour?: number): string {
  return hour !== undefined ? `${userId}-${dow}-${hour}` : `${userId}-${dow}`;
}

function runIteration(
  storeId: string,
  department: "sala" | "cucina",
  weekDates: string[],
  employees: EmployeeData[],
  availability: AvailSlot[],
  exceptions: ExceptionBlock[],
  coverage: CoverageReq[],
  allowedTimes: AllowedTime[],
  rules: StoreRules,
  runId: string,
  openingHours: { day_of_week: number; opening_time: string; closing_time: string }[],
  hourBalances: Map<string, number>,
  empConstraints: Map<string, EmployeeConstraints>,
  maxSplitsAllowed: number,
  randomize: boolean,
  partialDayBlocks: Map<string, Map<string, { blockedStart: number; blockedEnd: number }[]>>,
  smartMemory: SmartMemoryScores,
  preferShortShifts: boolean = false,
  reserveForSplit: number = 0,
): IterationResult {
  const deptEmployees = employees.filter(e => e.department === department && e.is_active);
  const deptCoverage = coverage.filter(c => c.department === department);

  const entries = allowedTimes
    .filter(t => t.department === department && t.kind === "entry" && t.is_active)
    .map(t => t.hour).sort((a, b) => a - b);
  const exits = allowedTimes
    .filter(t => t.department === department && t.kind === "exit" && t.is_active)
    .map(t => t.hour).sort((a, b) => a - b);

  const shifts: GeneratedShift[] = [];
  const uncoveredSlots: { date: string; hour: string }[] = [];
  const dayLogs: string[] = [];
  const empNameMap = new Map(employees.map(e => [e.user_id, `${(e as any).first_name ?? ""} ${(e as any).last_name ?? ""}`.trim() || e.user_id.slice(0, 8)]));
  const getEmpName = (uid: string) => empNameMap.get(uid) ?? uid.slice(0, 8);

  const weeklyHours = new Map<string, number>();
  const daysWorked = new Map<string, Set<string>>();
  const dailySplits = new Map<string, Map<string, number>>(); // user -> date -> shift count
  const weeklySplits = new Map<string, number>();
  // Track last shift end for 11h rest rule: user -> { date, endHour }
  const lastShiftEnd = new Map<string, { date: string; endHour: number }>();

  const maxDailyTeamHours = department === "sala" ? rules.max_daily_team_hours_sala : rules.max_daily_team_hours_cucina;
  const maxWeeklyTeamHours = department === "sala" ? rules.max_team_hours_sala_per_week : rules.max_team_hours_cucina_per_week;
  let weeklyTeamHoursUsed = 0;

  for (const emp of deptEmployees) {
    weeklyHours.set(emp.user_id, 0);
    daysWorked.set(emp.user_id, new Set());
    dailySplits.set(emp.user_id, new Map());
    weeklySplits.set(emp.user_id, 0);
  }

  // ── PRE-PLAN MANDATORY DAYS OFF ──────────────────────────────────────
  // Assign EXACTLY the mandatory minimum days off (typically 1) per employee.
  // NEVER assign more than the minimum proactively — extra days off are only
  // suggested post-generation when all coverage is already met and there's surplus.
  const prePlannedDaysOff = new Map<string, Set<string>>(); // userId -> Set<dateStr>
  {
    const deptCoverageLocal = coverage.filter(c => c.department === department);
    // Calculate daily demand (total staff-hours needed per day)
    const dailyDemand = new Map<string, number>();
    for (const dateStr of weekDates) {
      const dow = getDayOfWeek(dateStr);
      const dayCov = deptCoverageLocal.filter(c => c.day_of_week === dow);
      const demand = dayCov.reduce((sum, c) => sum + c.min_staff_required, 0);
      dailyDemand.set(dateStr, demand);
    }
    // Sort days by ascending demand (assign days off on least-busy days)
    const sortedDays = [...dailyDemand.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
    // Track how many employees are off each day (to avoid everyone off on same day)
    const dayOffCounts = new Map<string, number>();
    for (const d of weekDates) dayOffCounts.set(d, 0);

    // For each employee, assign EXACTLY mandatory_days_off (usually 1) days off
    const shuffledEmps = shuffle(deptEmployees);
    for (const emp of shuffledEmps) {
      const ec = empConstraints.get(emp.user_id);
      // Use the MINIMUM mandatory days off from rules (typically 1)
      const minDaysOff = ec?.custom_days_off ?? rules.mandatory_days_off_per_week;
      const empDaysOff = new Set<string>();

      // Find best days for this employee's days off
      // Sort candidate days: prefer low-demand days, break ties by fewer employees already off
      const candidateDays = sortedDays.filter(d => 
        isAvailable(emp.user_id, d, availability, exceptions)
      );
      candidateDays.sort((a, b) => {
        const demandDiff = (dailyDemand.get(a) ?? 0) - (dailyDemand.get(b) ?? 0);
        if (demandDiff !== 0) return demandDiff;
        return (dayOffCounts.get(a) ?? 0) - (dayOffCounts.get(b) ?? 0);
      });

      for (const day of candidateDays) {
        if (empDaysOff.size >= minDaysOff) break;
        empDaysOff.add(day);
        dayOffCounts.set(day, (dayOffCounts.get(day) ?? 0) + 1);
      }
      prePlannedDaysOff.set(emp.user_id, empDaysOff);
    }
  }

  // Log pre-planned days off
  {
    const doffSummary: string[] = [];
    for (const [uid, days] of prePlannedDaysOff) {
      if (days.size > 0) doffSummary.push(`${getEmpName(uid)}: riposo ${[...days].join(", ")}`);
    }
    dayLogs.push(`=== PRE-PIANIFICAZIONE RIPOSI ===`);
    dayLogs.push(`Riposi assegnati (${doffSummary.length} dipendenti): ${doffSummary.join(" | ")}`);
  }

  for (const dateStr of weekDates) {
    const dow = getDayOfWeek(dateStr);
    const dayCoverage = deptCoverage.filter(c => c.day_of_week === dow);
    if (dayCoverage.length === 0) continue;

    const oh = openingHours.find(h => h.day_of_week === dow);
    const dayOpenH = oh ? parseInt(oh.opening_time.split(":")[0], 10) : 9;
    const dayCloseH = oh ? parseInt(oh.closing_time.split(":")[0], 10) : 22;
    const effectiveClose = dayCloseH === 0 ? 24 : dayCloseH;

    const hourCoverage = new Map<number, number>();
    for (const c of dayCoverage) {
      const h = parseInt(c.hour_slot.split(":")[0], 10);
      hourCoverage.set(h, c.min_staff_required);
    }

    // ── Dynamic entry/exit points from coverage transitions ──
    // Add every hour where coverage demand changes as a valid entry/exit point.
    // This lets the engine create targeted short shifts (e.g. 13-15) that don't
    // cross into already-saturated hours, solving the overbooking deadlock.
    const covHoursSorted = [...hourCoverage.keys()].sort((a, b) => a - b);
    const dynamicEntries = new Set<number>(
      entries.length > 0 ? entries.filter(e => e >= dayOpenH && e < effectiveClose) : [dayOpenH]
    );
    const dynamicExits = new Set<number>(
      exits.length > 0 ? exits.filter(e => e > dayOpenH && e <= effectiveClose) : [effectiveClose]
    );
    // Add coverage boundary hours as entry/exit points
    for (const h of covHoursSorted) {
      if (h >= dayOpenH && h < effectiveClose) dynamicEntries.add(h);
      if (h > dayOpenH && h <= effectiveClose) dynamicExits.add(h);
    }
    // Also add h+1 for the last coverage hour (shift can end there)
    if (covHoursSorted.length > 0) {
      const lastCovH = covHoursSorted[covHoursSorted.length - 1];
      if (lastCovH + 1 <= effectiveClose) dynamicExits.add(lastCovH + 1);
    }
    // Add transition points: where demand changes significantly
    for (let idx = 1; idx < covHoursSorted.length; idx++) {
      const prevH = covHoursSorted[idx - 1];
      const currH = covHoursSorted[idx];
      if (currH === prevH + 1) {
        const prevNeed = hourCoverage.get(prevH) ?? 0;
        const currNeed = hourCoverage.get(currH) ?? 0;
        if (Math.abs(prevNeed - currNeed) >= 1) {
          // Transition point: add as both entry and exit
          if (currH >= dayOpenH && currH < effectiveClose) dynamicEntries.add(currH);
          if (currH > dayOpenH && currH <= effectiveClose) dynamicExits.add(currH);
        }
      }
    }

    const effectiveEntries = [...dynamicEntries].sort((a, b) => a - b);
    const effectiveExits = [...dynamicExits].sort((a, b) => a - b);
    if (effectiveEntries.length === 0 || effectiveExits.length === 0) continue;

    // Day header log
    const dayLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "short" });
    const covReqSummary = [...hourCoverage.entries()].sort((a,b)=>a[0]-b[0]).map(([h,n])=>`${h}:00=${n}p`).join(" ");
    dayLogs.push(`\n=== ${dayLabel.toUpperCase()} (${dateStr}) ===`);
    dayLogs.push(`Copertura richiesta: ${covReqSummary}`);
    dayLogs.push(`Orario: ${dayOpenH}:00-${effectiveClose}:00 | Entrate: [${effectiveEntries.join(",")}] | Uscite: [${effectiveExits.join(",")}]`);

    let dailyTeamHoursUsed = 0;

    let availableEmps = deptEmployees.filter(emp => {
      if (!isAvailable(emp.user_id, dateStr, availability, exceptions)) return false;
      // Pre-planned day off: skip this employee on their assigned rest day
      const plannedOff = prePlannedDaysOff.get(emp.user_id);
      if (plannedOff?.has(dateStr)) return false;
      // Days off constraint (per-employee or store-level)
      const ec = empConstraints.get(emp.user_id);
      const maxDaysWorked = 7 - (ec?.custom_days_off ?? rules.mandatory_days_off_per_week);
      const worked = daysWorked.get(emp.user_id)!;
      if (worked.size >= maxDaysWorked) return false;

      // 11h rest rule (HARD)
      const prev = lastShiftEnd.get(emp.user_id);
      if (prev) {
        const prevDate = new Date(prev.date + "T00:00:00Z");
        const currDate = new Date(dateStr + "T00:00:00Z");
        const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff === 1) {
          // Next day: need 11h rest from previous end
          const restAvailable = (24 - prev.endHour) + effectiveEntries[0];
          if (restAvailable < 11) return false;
        }
      }

      return true;
    });

    // Log available/excluded employees
    {
      const excluded = deptEmployees.filter(e => !availableEmps.some(a => a.user_id === e.user_id));
      const excludeReasons: string[] = [];
      for (const emp of excluded) {
        if (!isAvailable(emp.user_id, dateStr, availability, exceptions)) {
          excludeReasons.push(`${getEmpName(emp.user_id)}: non disponibile/eccezione`);
        } else if (prePlannedDaysOff.get(emp.user_id)?.has(dateStr)) {
          excludeReasons.push(`${getEmpName(emp.user_id)}: riposo pre-pianificato`);
        } else {
          const worked = daysWorked.get(emp.user_id)!;
          const ec = empConstraints.get(emp.user_id);
          const maxDaysWorked = 7 - (ec?.custom_days_off ?? rules.mandatory_days_off_per_week);
          if (worked.size >= maxDaysWorked) {
            excludeReasons.push(`${getEmpName(emp.user_id)}: max giorni lavorati (${worked.size}/${maxDaysWorked})`);
          } else {
            excludeReasons.push(`${getEmpName(emp.user_id)}: riposo 11h`);
          }
        }
      }
      dayLogs.push(`Disponibili: ${availableEmps.map(e => getEmpName(e.user_id)).join(", ")} (${availableEmps.length}/${deptEmployees.length})`);
      if (excludeReasons.length > 0) dayLogs.push(`Esclusi: ${excludeReasons.join(" | ")}`);
    }

    if (randomize) {
      availableEmps = shuffle(availableEmps);
    } else {
      // Smart memory: compute per-employee score for this day's coverage hours
      const covHours = Array.from(hourCoverage.keys());
      availableEmps.sort((a, b) => {
        const aUsed = weeklyHours.get(a.user_id) ?? 0;
        const bUsed = weeklyHours.get(b.user_id) ?? 0;
        const aBalance = hourBalances.get(a.user_id) ?? 0;
        const bBalance = hourBalances.get(b.user_id) ?? 0;
        const aTarget = a.weekly_contract_hours - aBalance;
        const bTarget = b.weekly_contract_hours - bBalance;
        const fillRatio = (aUsed / Math.max(aTarget, 1)) - (bUsed / Math.max(bTarget, 1));
        // Smart memory bonus: sum scores for this employee on this day's hours
        let aMemory = 0, bMemory = 0;
        for (const h of covHours) {
          aMemory += smartMemory.get(getSmartMemoryKey(a.user_id, dow, h)) ?? 0;
          bMemory += smartMemory.get(getSmartMemoryKey(b.user_id, dow, h)) ?? 0;
        }
        // Higher memory score = prioritize (sort ascending, so negate)
        // Memory influence is secondary to fill ratio
        return fillRatio + (bMemory - aMemory) * 0.01;
      });
    }

    const staffAssigned = new Map<number, number>();
    for (const [h] of hourCoverage) {
      staffAssigned.set(h, 0);
    }

    for (const emp of availableEmps) {
      const ec = empConstraints.get(emp.user_id);
      const empWeeklyUsed = weeklyHours.get(emp.user_id) ?? 0;
      const balance = hourBalances.get(emp.user_id) ?? 0;
      const adjustedTarget = emp.weekly_contract_hours - balance;
      const empMaxDaily = ec?.custom_max_daily_hours ?? rules.max_daily_hours_per_employee;
      const empMaxWeekly = ec?.custom_max_weekly_hours ?? rules.max_weekly_hours_per_employee;
      // If reserveForSplit > 0 and this is the first shift today, cap daily hours
      // to leave room for a potential split shift later
      const empDaySplitCount0 = dailySplits.get(emp.user_id)?.get(dateStr) ?? 0;
      const cappedDaily = reserveForSplit > 0 && empDaySplitCount0 === 0
        ? Math.max(empMaxDaily - reserveForSplit, 3)
        : empMaxDaily;
      const maxRemaining = Math.min(
        Math.max(adjustedTarget - empWeeklyUsed, 0),
        empMaxWeekly - empWeeklyUsed,
        cappedDaily,
      );
      if (maxRemaining <= 0) continue;
      if (weeklyTeamHoursUsed >= maxWeeklyTeamHours) break;
      if (dailyTeamHoursUsed >= maxDailyTeamHours) break;

      // Check split shift limit
      const empDaySplitCount = dailySplits.get(emp.user_id)?.get(dateStr) ?? 0;
      const empWeeklySplitCount = weeklySplits.get(emp.user_id) ?? 0;
      const maxSplitsWeek = Math.min(maxSplitsAllowed, ec?.custom_max_split_shifts ?? maxSplitsAllowed);
      if (empDaySplitCount >= 1 && empWeeklySplitCount >= maxSplitsWeek) continue;

      let hasUncovered = false;
      for (const [h, needed] of hourCoverage) {
        if ((staffAssigned.get(h) ?? 0) < needed) { hasUncovered = true; break; }
      }
      if (!hasUncovered) break;

      // 11h rest: determine earliest start for this employee today
      let earliestStart = 0;
      const prev = lastShiftEnd.get(emp.user_id);
      if (prev) {
        const prevDate = new Date(prev.date + "T00:00:00Z");
        const currDate = new Date(dateStr + "T00:00:00Z");
        const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff === 1) {
          earliestStart = Math.max(0, 11 - (24 - prev.endHour));
        }
      }

      let empAvail = getAvailableHoursForDay(emp.user_id, dateStr, availability);
      // Apply partial-day blocks (approved mattina_libera / sera_libera)
      const blocks = partialDayBlocks.get(emp.user_id)?.get(dateStr);
      if (blocks) {
        empAvail = applyPartialBlocks(empAvail, blocks);
      }
      if (empAvail.length === 0) continue;

      const MIN_SHIFT_HOURS = 3;
      let bestStart = -1, bestEnd = -1, bestCoverage = 0;
      let bestScore = -Infinity;

      // Compute transition exits: hours where coverage demand drops significantly
      const transitionExits = new Set<number>();
      if (preferShortShifts) {
        for (let idx = 1; idx < covHoursSorted.length; idx++) {
          const prevH = covHoursSorted[idx - 1];
          const currH = covHoursSorted[idx];
          if (currH === prevH + 1) {
            const prevNeed = hourCoverage.get(prevH) ?? 0;
            const currNeed = hourCoverage.get(currH) ?? 0;
            if (prevNeed - currNeed >= 2) {
              transitionExits.add(currH);
            }
          }
        }
      }

      for (const entry of effectiveEntries) {
        if (entry < earliestStart) continue;
        for (const exit of effectiveExits) {
          if (exit <= entry) continue;
          const duration = exit - entry;
          if (duration < MIN_SHIFT_HOURS) continue;
          if (duration > maxRemaining || duration > empMaxDaily) continue;
          if (dailyTeamHoursUsed + duration > maxDailyTeamHours) continue;

          const withinAvail = empAvail.some(a => entry >= a.start && exit <= a.end);
          if (!withinAvail) continue;

          // Exact coverage: reject shifts that would cause ANY tracked hour to exceed its required staff
          let wouldOverbook = false;
          let coverCount = 0;
          for (let h = entry; h < exit; h++) {
            const needed = hourCoverage.get(h);
            if (needed !== undefined) {
              const current = staffAssigned.get(h) ?? 0;
              if (current >= needed) { wouldOverbook = true; break; }
              if (current < needed) coverCount++;
            }
          }
          if (wouldOverbook) continue;

          if (preferShortShifts) {
            // Density-based scoring: prefer shorter shifts that cover more uncovered hours per hour worked
            const density = coverCount / duration;
            const transitionBonus = transitionExits.has(exit) ? 0.1 : 0;
            const score = density + transitionBonus;
            if (score > bestScore || (score === bestScore && duration < (bestEnd - bestStart))) {
              bestScore = score;
              bestCoverage = coverCount;
              bestStart = entry;
              bestEnd = exit;
            }
          } else {
            // Original strategy: max coverage, then shortest duration
            if (coverCount > bestCoverage || (coverCount === bestCoverage && duration < (bestEnd - bestStart))) {
              bestCoverage = coverCount;
              bestStart = entry;
              bestEnd = exit;
            }
          }
        }
      }

      if (bestStart >= 0 && bestEnd > bestStart) {
        const duration = bestEnd - bestStart;
        const isSplit = empDaySplitCount > 0;

        dayLogs.push(`  ✅ ${getEmpName(emp.user_id)}: ${bestStart}:00-${bestEnd === 24 ? 0 : bestEnd}:00 (${duration}h) — copre ${bestCoverage} slot scoperti${isSplit ? " [SPEZZATO]" : ""} | ore sett: ${empWeeklyUsed}+${duration}=${empWeeklyUsed+duration}/${emp.weekly_contract_hours}h`);

        shifts.push({
          store_id: storeId,
          user_id: emp.user_id,
          date: dateStr,
          start_time: `${String(bestStart).padStart(2, "0")}:00`,
          end_time: `${String(bestEnd === 24 ? 0 : bestEnd).padStart(2, "0")}:00`,
          department,
          is_day_off: false,
          status: "draft",
          generation_run_id: runId,
        });

        weeklyHours.set(emp.user_id, empWeeklyUsed + duration);
        daysWorked.get(emp.user_id)!.add(dateStr);
        dailyTeamHoursUsed += duration;
        weeklyTeamHoursUsed += duration;

        // Track splits
        const empDailySplits = dailySplits.get(emp.user_id)!;
        empDailySplits.set(dateStr, (empDailySplits.get(dateStr) ?? 0) + 1);
        if (isSplit) {
          weeklySplits.set(emp.user_id, (weeklySplits.get(emp.user_id) ?? 0) + 1);
        }

        // Track last shift end for 11h rest
        const existingEnd = lastShiftEnd.get(emp.user_id);
        if (!existingEnd || dateStr > existingEnd.date || (dateStr === existingEnd.date && bestEnd > existingEnd.endHour)) {
          lastShiftEnd.set(emp.user_id, { date: dateStr, endHour: bestEnd === 24 ? 24 : bestEnd });
        }

        for (let h = bestStart; h < bestEnd; h++) {
          if (staffAssigned.has(h)) {
            staffAssigned.set(h, (staffAssigned.get(h) ?? 0) + 1);
          }
        }
      } else {
        // Log why no shift was assigned
        const empWeeklyUsedLog = weeklyHours.get(emp.user_id) ?? 0;
        const balanceLog = hourBalances.get(emp.user_id) ?? 0;
        const adjTarget = emp.weekly_contract_hours - balanceLog;
        const remainingLog = Math.max(adjTarget - empWeeklyUsedLog, 0);
        if (remainingLog <= 0) {
          dayLogs.push(`  ⏭️ ${getEmpName(emp.user_id)}: saltato — ore sett. esaurite (${empWeeklyUsedLog}/${adjTarget}h)`);
        } else {
          dayLogs.push(`  ⏭️ ${getEmpName(emp.user_id)}: saltato — nessun turno valido trovato (ore disp: ${remainingLog}h, team budget: ${dailyTeamHoursUsed}/${maxDailyTeamHours}h)`);
        }
      }
    }

    // Log first pass summary
    {
      const firstPassCov: string[] = [];
      for (const [h, needed] of [...hourCoverage.entries()].sort((a,b)=>a[0]-b[0])) {
        const assigned = staffAssigned.get(h) ?? 0;
        if (assigned < needed) firstPassCov.push(`${h}:00 (${assigned}/${needed})`);
      }
      if (firstPassCov.length > 0) {
        dayLogs.push(`  📊 Dopo 1° pass: ${firstPassCov.length} slot ancora scoperti: ${firstPassCov.join(", ")}`);
      } else {
        dayLogs.push(`  📊 Dopo 1° pass: copertura completa ✅`);
      }
    }

    // ── SECOND PASS: Split shifts for employees already working this day ──
    let hasUncoveredAfterFirst = false;
    for (const [h, needed] of hourCoverage) {
      if ((staffAssigned.get(h) ?? 0) < needed) { hasUncoveredAfterFirst = true; break; }
    }

    if (hasUncoveredAfterFirst) {
      dayLogs.push(`  🔀 2° pass (spezzati):`);
      // Get employees who already have a shift today (candidates for a split)
      // Get employees who already have a shift today (candidates for a split)
      const empsWithShiftToday = deptEmployees.filter(emp => {
        const dayShiftCount = dailySplits.get(emp.user_id)?.get(dateStr) ?? 0;
        return dayShiftCount >= 1; // already worked today
      });

      let splitCandidates = randomize ? shuffle(empsWithShiftToday) : empsWithShiftToday.slice();
      // Sort by ascending weekly split count for equitable distribution
      splitCandidates.sort((a, b) => (weeklySplits.get(a.user_id) ?? 0) - (weeklySplits.get(b.user_id) ?? 0));

      for (const emp of splitCandidates) {
        const ec = empConstraints.get(emp.user_id);
        const empWeeklyUsed = weeklyHours.get(emp.user_id) ?? 0;
        const balance = hourBalances.get(emp.user_id) ?? 0;
        const adjustedTarget = emp.weekly_contract_hours - balance;
        const empMaxDaily = ec?.custom_max_daily_hours ?? rules.max_daily_hours_per_employee;
        const empMaxWeekly = ec?.custom_max_weekly_hours ?? rules.max_weekly_hours_per_employee;

        // Calculate hours already worked today
        const todayShifts = shifts.filter(s => s.user_id === emp.user_id && s.date === dateStr && !s.is_day_off && s.start_time && s.end_time);
        const dailyHoursUsed = todayShifts.reduce((sum, s) => sum + (parseHour(s.end_time!) - parseHour(s.start_time!)), 0);

        const maxRemainingDaily = empMaxDaily - dailyHoursUsed;
        const maxRemainingWeekly = empMaxWeekly - empWeeklyUsed;
        // For split shifts, allow going beyond contract target up to weekly max
        // This enables splits to cover gaps even when contract hours are exhausted
        const maxRemaining = Math.min(maxRemainingDaily, maxRemainingWeekly);
        if (maxRemaining <= 0) continue;

        // Check weekly split limit
        const empWeeklySplitCount = weeklySplits.get(emp.user_id) ?? 0;
        const maxSplitsWeek = Math.min(maxSplitsAllowed, ec?.custom_max_split_shifts ?? maxSplitsAllowed);
        if (empWeeklySplitCount >= maxSplitsWeek) continue;

        // Check team hour limits
        if (weeklyTeamHoursUsed >= maxWeeklyTeamHours) break;
        if (dailyTeamHoursUsed >= maxDailyTeamHours) break;

        // Still uncovered?
        let stillUncovered = false;
        for (const [h, needed] of hourCoverage) {
          if ((staffAssigned.get(h) ?? 0) < needed) { stillUncovered = true; break; }
        }
        if (!stillUncovered) break;

        // Find the end hour of the last shift today for this employee (for 2h gap)
        const lastEndToday = Math.max(...todayShifts.map(s => parseHour(s.end_time!)));

        // The new split shift must start at least 2h after the last shift ended
        const earliestSplitStart = lastEndToday + 2;

        let empAvail = getAvailableHoursForDay(emp.user_id, dateStr, availability);
        const blocks2 = partialDayBlocks.get(emp.user_id)?.get(dateStr);
        if (blocks2) {
          empAvail = applyPartialBlocks(empAvail, blocks2);
        }
        if (empAvail.length === 0) continue;

        const MIN_SHIFT_HOURS_SPLIT = 3;
        let bestStart = -1, bestEnd = -1, bestCoverage = 0;

        for (const entry of effectiveEntries) {
          if (entry < earliestSplitStart) continue;
          for (const exit of effectiveExits) {
            if (exit <= entry) continue;
            const duration = exit - entry;
            if (duration < MIN_SHIFT_HOURS_SPLIT) continue; // Minimum 4 hours for split shifts too
            if (duration > maxRemaining) continue;
            if (dailyTeamHoursUsed + duration > maxDailyTeamHours) continue;

            const withinAvail = empAvail.some(a => entry >= a.start && exit <= a.end);
            if (!withinAvail) continue;

            // Exact coverage: reject if any hour would exceed required staff
            let wouldOverbook = false;
            let coverCount = 0;
            for (let h = entry; h < exit; h++) {
              const needed = hourCoverage.get(h);
              if (needed !== undefined) {
                const current = staffAssigned.get(h) ?? 0;
                if (current >= needed) { wouldOverbook = true; break; }
                if (current < needed) coverCount++;
              }
            }
            if (wouldOverbook) continue;

            if (coverCount > bestCoverage || (coverCount === bestCoverage && duration < (bestEnd - bestStart))) {
              bestCoverage = coverCount;
              bestStart = entry;
              bestEnd = exit;
            }
          }
        }

        if (bestStart >= 0 && bestEnd > bestStart) {
          const duration = bestEnd - bestStart;
          dayLogs.push(`    ✅ ${getEmpName(emp.user_id)}: spezzato ${bestStart}:00-${bestEnd === 24 ? 0 : bestEnd}:00 (${duration}h) — copre ${bestCoverage} slot`);

          shifts.push({
            store_id: storeId,
            user_id: emp.user_id,
            date: dateStr,
            start_time: `${String(bestStart).padStart(2, "0")}:00`,
            end_time: `${String(bestEnd === 24 ? 0 : bestEnd).padStart(2, "0")}:00`,
            department,
            is_day_off: false,
            status: "draft",
            generation_run_id: runId,
          });

          weeklyHours.set(emp.user_id, empWeeklyUsed + duration);
          dailyTeamHoursUsed += duration;
          weeklyTeamHoursUsed += duration;

          // Update splits tracking
          const empDailySplits = dailySplits.get(emp.user_id)!;
          empDailySplits.set(dateStr, (empDailySplits.get(dateStr) ?? 0) + 1);
          weeklySplits.set(emp.user_id, (weeklySplits.get(emp.user_id) ?? 0) + 1);

          // Update last shift end
          const existingEnd = lastShiftEnd.get(emp.user_id);
          if (!existingEnd || dateStr > existingEnd.date || (dateStr === existingEnd.date && bestEnd > existingEnd.endHour)) {
            lastShiftEnd.set(emp.user_id, { date: dateStr, endHour: bestEnd === 24 ? 24 : bestEnd });
          }

          for (let h = bestStart; h < bestEnd; h++) {
            if (staffAssigned.has(h)) {
              staffAssigned.set(h, (staffAssigned.get(h) ?? 0) + 1);
            }
          }
        }
      }
    }

    // ── THIRD PASS: Gap-filling with any available employee using dynamic entry/exit ──
    // This catches cases where the first pass skipped employees because all shifts
    // from original entry/exit points crossed saturated hours, but now dynamic
    // points allow creating short targeted shifts.
    let hasUncoveredAfterSplits = false;
    for (const [h, needed] of hourCoverage) {
      if ((staffAssigned.get(h) ?? 0) < needed) { hasUncoveredAfterSplits = true; break; }
    }

    if (hasUncoveredAfterSplits) {
      dayLogs.push(`  🔍 3° pass (gap-filling):`);
      // Try ALL available employees (including those without shifts today)
      let gapFillers = deptEmployees.filter(emp => {
        if (!isAvailable(emp.user_id, dateStr, availability, exceptions)) return false;
        const ec = empConstraints.get(emp.user_id);
        const empMaxWeekly = ec?.custom_max_weekly_hours ?? rules.max_weekly_hours_per_employee;
        const empWeeklyUsed = weeklyHours.get(emp.user_id) ?? 0;
        if (empWeeklyUsed >= empMaxWeekly) return false;
        // Check days off limit
        const maxDaysWorked = 7 - (ec?.custom_days_off ?? rules.mandatory_days_off_per_week);
        const worked = daysWorked.get(emp.user_id)!;
        if (worked.size >= maxDaysWorked && !worked.has(dateStr)) return false;
        return true;
      });
      gapFillers = randomize ? shuffle(gapFillers) : gapFillers;

      for (const emp of gapFillers) {
        let stillUncovered = false;
        for (const [h, needed] of hourCoverage) {
          if ((staffAssigned.get(h) ?? 0) < needed) { stillUncovered = true; break; }
        }
        if (!stillUncovered) break;
        if (weeklyTeamHoursUsed >= maxWeeklyTeamHours) break;
        if (dailyTeamHoursUsed >= maxDailyTeamHours) break;

        const ec = empConstraints.get(emp.user_id);
        const empWeeklyUsed = weeklyHours.get(emp.user_id) ?? 0;
        const empMaxDaily = ec?.custom_max_daily_hours ?? rules.max_daily_hours_per_employee;
        const empMaxWeekly = ec?.custom_max_weekly_hours ?? rules.max_weekly_hours_per_employee;

        // Check if already has shifts today
        const todayShifts = shifts.filter(s => s.user_id === emp.user_id && s.date === dateStr && !s.is_day_off && s.start_time && s.end_time);
        const dailyHoursUsed = todayShifts.reduce((sum, s) => sum + (parseHour(s.end_time!) - parseHour(s.start_time!)), 0);
        const maxRemainingDaily = empMaxDaily - dailyHoursUsed;
        const maxRemainingWeekly = empMaxWeekly - empWeeklyUsed;
        const maxRemaining = Math.min(maxRemainingDaily, maxRemainingWeekly);
        if (maxRemaining < 3) continue; // MIN_SHIFT_HOURS

        // If already has a shift today, enforce split constraints
        if (todayShifts.length > 0) {
          const empWeeklySplitCount = weeklySplits.get(emp.user_id) ?? 0;
          const maxSplitsWeek = Math.min(maxSplitsAllowed, ec?.custom_max_split_shifts ?? maxSplitsAllowed);
          if (empWeeklySplitCount >= maxSplitsWeek) continue;
        }

        // 11h rest
        let earliestStart = 0;
        const prev = lastShiftEnd.get(emp.user_id);
        if (prev) {
          const prevDate = new Date(prev.date + "T00:00:00Z");
          const currDate = new Date(dateStr + "T00:00:00Z");
          const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
          if (dayDiff === 1) {
            earliestStart = Math.max(0, 11 - (24 - prev.endHour));
          }
        }

        // If has a shift today, enforce 2h gap
        if (todayShifts.length > 0) {
          const lastEndToday = Math.max(...todayShifts.map(s => parseHour(s.end_time!)));
          earliestStart = Math.max(earliestStart, lastEndToday + 2);
        }

        let empAvail = getAvailableHoursForDay(emp.user_id, dateStr, availability);
        const blocks3 = partialDayBlocks.get(emp.user_id)?.get(dateStr);
        if (blocks3) empAvail = applyPartialBlocks(empAvail, blocks3);
        if (empAvail.length === 0) continue;

        // Find the best short shift covering only uncovered hours
        let bestStart = -1, bestEnd = -1, bestCoverage = 0;
        for (const entry of effectiveEntries) {
          if (entry < earliestStart) continue;
          for (const exit of effectiveExits) {
            if (exit <= entry) continue;
            const duration = exit - entry;
            if (duration < 3) continue;
            if (duration > maxRemaining) continue;
            if (dailyTeamHoursUsed + duration > maxDailyTeamHours) continue;

            const withinAvail = empAvail.some(a => entry >= a.start && exit <= a.end);
            if (!withinAvail) continue;

            // STRICT no overbooking
            let wouldOverbook = false;
            let coverCount = 0;
            for (let h = entry; h < exit; h++) {
              const needed = hourCoverage.get(h);
              if (needed !== undefined) {
                const current = staffAssigned.get(h) ?? 0;
                if (current >= needed) { wouldOverbook = true; break; }
                if (current < needed) coverCount++;
              }
            }
            if (wouldOverbook) continue;
            if (coverCount === 0) continue;

            if (coverCount > bestCoverage || (coverCount === bestCoverage && duration < (bestEnd - bestStart))) {
              bestCoverage = coverCount;
              bestStart = entry;
              bestEnd = exit;
            }
          }
        }

        if (bestStart >= 0 && bestEnd > bestStart) {
          const duration = bestEnd - bestStart;
          const isSplit = todayShifts.length > 0;
          dayLogs.push(`    ✅ ${getEmpName(emp.user_id)}: gap-fill ${bestStart}:00-${bestEnd === 24 ? 0 : bestEnd}:00 (${duration}h)${isSplit ? " [SPEZZATO]" : ""}`);

          shifts.push({
            store_id: storeId, user_id: emp.user_id, date: dateStr,
            start_time: `${String(bestStart).padStart(2, "0")}:00`,
            end_time: `${String(bestEnd === 24 ? 0 : bestEnd).padStart(2, "0")}:00`,
            department, is_day_off: false, status: "draft", generation_run_id: runId,
          });

          weeklyHours.set(emp.user_id, empWeeklyUsed + duration);
          daysWorked.get(emp.user_id)!.add(dateStr);
          dailyTeamHoursUsed += duration;
          weeklyTeamHoursUsed += duration;

          const empDailySplits = dailySplits.get(emp.user_id)!;
          empDailySplits.set(dateStr, (empDailySplits.get(dateStr) ?? 0) + 1);
          if (isSplit) {
            weeklySplits.set(emp.user_id, (weeklySplits.get(emp.user_id) ?? 0) + 1);
          }

          const existingEnd = lastShiftEnd.get(emp.user_id);
          if (!existingEnd || dateStr > existingEnd.date || (dateStr === existingEnd.date && bestEnd > existingEnd.endHour)) {
            lastShiftEnd.set(emp.user_id, { date: dateStr, endHour: bestEnd === 24 ? 24 : bestEnd });
          }

          for (let h = bestStart; h < bestEnd; h++) {
            if (staffAssigned.has(h)) {
              staffAssigned.set(h, (staffAssigned.get(h) ?? 0) + 1);
            }
          }
        }
      }
    }

    // Assign days off
    for (const emp of deptEmployees) {
      if (!daysWorked.get(emp.user_id)?.has(dateStr)) {
        if (isAvailable(emp.user_id, dateStr, availability, exceptions)) {
          shifts.push({
            store_id: storeId, user_id: emp.user_id, date: dateStr,
            start_time: null, end_time: null, department,
            is_day_off: true, status: "draft", generation_run_id: runId,
          });
        }
      }
    }

    // Day-end uncovered summary
    const dayUncovered: string[] = [];
    for (const [h, needed] of hourCoverage) {
      const assigned = staffAssigned.get(h) ?? 0;
      if (assigned < needed) {
        uncoveredSlots.push({ date: dateStr, hour: `${String(h).padStart(2, "0")}:00` });
        dayUncovered.push(`${h}:00 (${assigned}/${needed})`);
      }
    }
    if (dayUncovered.length > 0) {
      dayLogs.push(`  ❌ SCOPERTI: ${dayUncovered.join(", ")}`);
      dayLogs.push(`  💡 Motivo: insufficiente personale disponibile o vincoli (ore max, spezzati, riposo 11h) impediscono ulteriore copertura`);
    } else {
      dayLogs.push(`  ✅ GIORNO COMPLETAMENTE COPERTO`);
    }

    // Day-end team summary
    dayLogs.push(`  📈 Team: ${dailyTeamHoursUsed}h usate / ${maxDailyTeamHours}h max giornaliere`);
  }

  // Weekly summary
  dayLogs.push(`\n=== RIEPILOGO SETTIMANALE ===`);
  const ec_rules = rules;
  for (const emp of deptEmployees) {
    const wh = weeklyHours.get(emp.user_id) ?? 0;
    const ws = weeklySplits.get(emp.user_id) ?? 0;
    const ec = empConstraints.get(emp.user_id);
    const maxSplitsWeek = ec?.custom_max_split_shifts ?? ec_rules.max_split_shifts_per_employee_per_week;
    const minDaysOff = ec?.custom_days_off ?? ec_rules.mandatory_days_off_per_week;
    const daysOff = [...weekDates].filter(d => !daysWorked.get(emp.user_id)?.has(d)).length;
    const issues: string[] = [];
    if (daysOff < minDaysOff) issues.push(`⚠️ riposi ${daysOff}<${minDaysOff}`);
    if (ws > maxSplitsWeek) issues.push(`⚠️ spezzati ${ws}>${maxSplitsWeek}`);
    if (wh > (ec?.custom_max_weekly_hours ?? ec_rules.max_weekly_hours_per_employee)) issues.push(`⚠️ ore eccessive`);
    dayLogs.push(`${getEmpName(emp.user_id)}: ${wh}h/${emp.weekly_contract_hours}h contratto | ${ws}/${maxSplitsWeek} spezzati | ${daysOff}/${minDaysOff}+ riposi${issues.length > 0 ? " " + issues.join(" ") : " ✅"}`);
  }

  const { score, hourAdjustments } = computeFitness(shifts, uncoveredSlots, employees, coverage, weekDates, hourBalances, department);

  return { shifts, uncoveredSlots, fitnessScore: score, hourAdjustments, dayLogs };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth
    const authHeader = req.headers.get("Authorization");
    let callerUserId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== anonKey && token !== serviceRoleKey) {
        const anonClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData } = await anonClient.auth.getUser();
        if (!userData?.user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        callerUserId = userData.user.id;
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (callerUserId) {
      const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: callerUserId });
      if (callerRole !== "super_admin" && callerRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { store_id, week_start_date, mode, affected_user_id, exception_start_date, exception_end_date, skip_lending, locked_shift_ids } = body;
    const isPatchMode = mode === "patch";
    const isRebalanceMode = mode === "rebalance";
    const MAX_ITERATIONS = 12;
    const START_TIME = Date.now();
    const MAX_EXECUTION_MS = 120_000; // 120s hard limit (edge fn ~150s timeout)
    const isTimeBudgetOk = () => (Date.now() - START_TIME) < MAX_EXECUTION_MS;

    if (!store_id || !week_start_date) {
      return new Response(JSON.stringify({ error: "store_id and week_start_date required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startD = new Date(week_start_date + "T00:00:00Z");
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const weekEnd = getDateStr(endD);
    const weekDates = getWeekDates(week_start_date);

    // Fetch all data in parallel
    const [empRes, availRes, excRes, covRes, allowedRes, rulesRes, ohRes, requestsRes, statsRes, constraintsRes] = await Promise.all([
      adminClient.from("employee_details").select("user_id, department, weekly_contract_hours, is_active, first_name, last_name"),
      adminClient.from("employee_availability").select("user_id, day_of_week, start_time, end_time").eq("store_id", store_id),
      adminClient.from("employee_exceptions").select("user_id, start_date, end_date").eq("store_id", store_id).lte("start_date", weekEnd).gte("end_date", week_start_date),
      adminClient.from("store_coverage_requirements").select("*").eq("store_id", store_id),
      adminClient.from("store_shift_allowed_times").select("*").eq("store_id", store_id),
      adminClient.from("store_rules").select("*").eq("store_id", store_id).single(),
      adminClient.from("store_opening_hours").select("*").eq("store_id", store_id),
      adminClient.from("time_off_requests").select("user_id, request_date, request_type, selected_hour, status")
        .eq("store_id", store_id).eq("status", "approved").gte("request_date", week_start_date).lte("request_date", weekEnd),
      adminClient.from("employee_stats").select("user_id, current_balance").eq("store_id", store_id),
      adminClient.from("employee_constraints").select("*").eq("store_id", store_id),
    ]);

    if (rulesRes.error || !rulesRes.data) throw new Error("Store rules not found");

    const { data: assignments } = await adminClient
      .from("user_store_assignments").select("user_id").eq("store_id", store_id);
    const storeUserIds = new Set((assignments ?? []).map(a => a.user_id));

    const employees = (empRes.data ?? []).filter(e => storeUserIds.has(e.user_id)) as EmployeeData[];
    const availability = (availRes.data ?? []) as AvailSlot[];

    const baseExceptions = (excRes.data ?? []) as ExceptionBlock[];
    // Only full-day approved requests become full-day exceptions.
    // Partial-day requests (mattina_libera, sera_libera) are handled as availability constraints, not exceptions.
    const fullDayRequestTypes = ["giorno_libero", "ferie", "malattia"];
    const approvedFullDayRequests = (requestsRes.data ?? [])
      .filter((r: any) => fullDayRequestTypes.includes(r.request_type))
      .map((r: any) => ({
        user_id: r.user_id, start_date: r.request_date, end_date: r.request_date,
      }));
    const allExceptions = [...baseExceptions, ...approvedFullDayRequests];

    // Partial-day approved requests: create synthetic availability constraints
    // that block the requested half of the day
    const partialDayRequests = (requestsRes.data ?? [])
      .filter((r: any) => !fullDayRequestTypes.includes(r.request_type) && r.request_type !== "cambio_turno");
    const partialDayBlocks = new Map<string, Map<string, { blockedStart: number; blockedEnd: number }[]>>();
    for (const r of partialDayRequests as any[]) {
      const key = r.user_id;
      if (!partialDayBlocks.has(key)) partialDayBlocks.set(key, new Map());
      const dateMap = partialDayBlocks.get(key)!;
      if (!dateMap.has(r.request_date)) dateMap.set(r.request_date, []);
      if (r.request_type === "mattina_libera") {
        // Block morning: employee unavailable until selected_hour or 14
        dateMap.get(r.request_date)!.push({ blockedStart: 0, blockedEnd: r.selected_hour ?? 14 });
      } else if (r.request_type === "sera_libera") {
        // Block evening: employee unavailable from selected_hour or 18
        dateMap.get(r.request_date)!.push({ blockedStart: r.selected_hour ?? 18, blockedEnd: 24 });
      }
    }

    const coverageData = (covRes.data ?? []) as CoverageReq[];
    const allowedData = (allowedRes.data ?? []) as AllowedTime[];
    const rules: StoreRules = rulesRes.data as any;
    const openingHoursData = (ohRes.data ?? []).map((h: any) => ({
      day_of_week: h.day_of_week, opening_time: h.opening_time, closing_time: h.closing_time,
    }));

    const hourBalances = new Map<string, number>();
    for (const s of (statsRes.data ?? [])) {
      hourBalances.set(s.user_id, Number(s.current_balance));
    }

    // Apply previous week's manual adjustments to hourBalances
    const prevWeekStart = new Date(startD);
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);
    const prevWeekStartStr = getDateStr(prevWeekStart);
    const { data: prevAdjustments } = await adminClient
      .from("generation_adjustments")
      .select("user_id, extra_hours")
      .eq("store_id", store_id)
      .eq("week_start", prevWeekStartStr);

    for (const adj of (prevAdjustments ?? [])) {
      const current = hourBalances.get(adj.user_id) ?? 0;
      hourBalances.set(adj.user_id, current - Number(adj.extra_hours));
    }

    const empConstraints = new Map<string, EmployeeConstraints>();
    for (const c of (constraintsRes.data ?? [])) {
      empConstraints.set(c.user_id, c as EmployeeConstraints);
    }

    // ─── Smart Memory: fetch historical outcomes (last 8 weeks) ──────
    const SMART_MEMORY_WEEKS = 8;
    const memoryStartDate = new Date(startD);
    memoryStartDate.setUTCDate(memoryStartDate.getUTCDate() - SMART_MEMORY_WEEKS * 7);
    const memoryStartStr = getDateStr(memoryStartDate);

    const { data: outcomeRows } = await adminClient
      .from("suggestion_outcomes")
      .select("user_id, day_of_week, hour_slot, outcome")
      .eq("store_id", store_id)
      .gte("week_start", memoryStartStr);

    // Build smart memory scores: accepted = +1, rejected = -1, gap_accepted = -0.5
    const smartMemory: SmartMemoryScores = new Map();
    for (const row of (outcomeRows ?? [])) {
      const key = getSmartMemoryKey(row.user_id, row.day_of_week, row.hour_slot);
      const current = smartMemory.get(key) ?? 0;
      const delta = row.outcome === "accepted" || row.outcome === "lending_accepted" ? 1
        : row.outcome === "rejected" || row.outcome === "lending_rejected" ? -1
        : row.outcome === "gap_accepted" ? -0.5
        : 0;
      smartMemory.set(key, current + delta);
    }
    console.log(`[Smart Memory] Loaded ${(outcomeRows ?? []).length} historical outcomes, ${smartMemory.size} unique scores`);

    // Run for BOTH departments
    const departments: ("sala" | "cucina")[] = ["sala", "cucina"];
    const results: { department: string; runId: string; shifts: number; daysOff: number; uncovered: number; fitness: number; hourAdjustments: Record<string, number>; fallbackUsed: boolean }[] = [];

    // ═══════════════════════════════════════════════════════════════════
    // CLEAN REGENERATION: delete ALL previous data for this store+week
    // before generating new shifts. Only in FULL mode (not patch).
    // ═══════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════
    // REBALANCE MODE: keep locked shifts, regenerate everything else
    // ═══════════════════════════════════════════════════════════════════
    const lockedShiftIds = new Set<string>(Array.isArray(locked_shift_ids) ? locked_shift_ids : []);
    
    if (isRebalanceMode && lockedShiftIds.size > 0) {
      console.log(`[REBALANCE] Keeping ${lockedShiftIds.size} locked shifts, regenerating others for store=${store_id}, week=${week_start_date}..${weekEnd}`);

      // Delete NON-locked draft shifts for this store+week
      const { data: existingDrafts } = await adminClient.from("shifts").select("id")
        .eq("store_id", store_id).eq("status", "draft")
        .gte("date", week_start_date).lte("date", weekEnd);
      
      const toDelete = (existingDrafts ?? []).filter(s => !lockedShiftIds.has(s.id)).map(s => s.id);
      if (toDelete.length > 0) {
        // Delete in batches
        for (let i = 0; i < toDelete.length; i += 100) {
          await adminClient.from("shifts").delete().in("id", toDelete.slice(i, i + 100));
        }
      }
      console.log(`[REBALANCE] Deleted ${toDelete.length} non-locked drafts, kept ${lockedShiftIds.size} locked`);

      // Delete old generation_runs (but keep the locked shifts in place)
      const { data: oldRuns } = await adminClient.from("generation_runs").select("id")
        .eq("store_id", store_id).eq("week_start", week_start_date);
      const oldRunIds = (oldRuns ?? []).map(r => r.id);
      if (oldRunIds.length > 0) {
        await adminClient.from("lending_suggestions").delete().in("generation_run_id", oldRunIds);
        await adminClient.from("generation_runs").delete().in("id", oldRunIds);
      }
    } else if (!isPatchMode) {
      // CLEAN REGENERATION: delete ALL previous data for this store+week
      console.log(`[CLEANUP] Deleting previous data for store=${store_id}, week=${week_start_date}..${weekEnd}`);

      // 1) Delete lending_request_messages for lending_requests involving this store+week
      const { data: oldLendingReqs } = await adminClient
        .from("lending_requests")
        .select("id")
        .or(`proposer_store_id.eq.${store_id},receiver_store_id.eq.${store_id}`)
        .gte("date", week_start_date)
        .lte("date", weekEnd);

      const oldLrIds = (oldLendingReqs ?? []).map(r => r.id);
      if (oldLrIds.length > 0) {
        await adminClient.from("lending_request_messages").delete().in("lending_request_id", oldLrIds);
        await adminClient.from("lending_requests").delete().in("id", oldLrIds);
        console.log(`[CLEANUP] Deleted ${oldLrIds.length} lending_requests + messages`);
      }

      // 2) Delete old generation_runs, lending_suggestions, generation_adjustments, and draft shifts
      const { data: oldRuns } = await adminClient
        .from("generation_runs")
        .select("id")
        .eq("store_id", store_id)
        .eq("week_start", week_start_date);

      const oldRunIds = (oldRuns ?? []).map(r => r.id);
      if (oldRunIds.length > 0) {
        await adminClient.from("lending_suggestions").delete().in("generation_run_id", oldRunIds);
        console.log(`[CLEANUP] Deleted lending_suggestions for ${oldRunIds.length} old runs`);
      }

      // Delete generation_adjustments for this store+week
      await adminClient.from("generation_adjustments").delete()
        .eq("store_id", store_id).eq("week_start", week_start_date);

      // Delete old generation_runs themselves
      if (oldRunIds.length > 0) {
        await adminClient.from("generation_runs").delete().in("id", oldRunIds);
        console.log(`[CLEANUP] Deleted ${oldRunIds.length} old generation_runs`);
      }

      // Delete ALL draft shifts for this store+week (both depts at once)
      await adminClient.from("shifts").delete()
        .eq("store_id", store_id).eq("status", "draft")
        .gte("date", week_start_date).lte("date", weekEnd);

      console.log(`[CLEANUP] Complete for store=${store_id}, week=${week_start_date}`);
    }

    for (const dept of departments) {
      const deptEmployees = employees.filter(e => e.department === dept && e.is_active);
      if (deptEmployees.length === 0) continue;

      // Create generation run
      const { data: run, error: runErr } = await adminClient
        .from("generation_runs")
        .insert({
          store_id, department: dept, week_start: week_start_date, week_end: weekEnd,
          status: "running", created_by: callerUserId,
        })
        .select("id")
        .single();

      if (runErr || !run) throw new Error(`Failed to create generation run: ${runErr?.message}`);

      try {
        // Determine effective date range for patch mode
        const today = getDateStr(new Date());
        const patchStartDate = isPatchMode && exception_start_date 
          ? (exception_start_date > today ? exception_start_date : today) 
          : week_start_date;
        const patchEndDate = isPatchMode && exception_end_date
          ? (exception_end_date < weekEnd ? exception_end_date : weekEnd)
          : weekEnd;
        // Filter weekDates to only dates in the patch range
        const effectiveWeekDates = isPatchMode 
          ? weekDates.filter(d => d >= patchStartDate && d <= patchEndDate)
          : weekDates;

        if (isPatchMode && affected_user_id) {
          // PATCH MODE: delete affected user's shifts (draft OR published) from patchStartDate onward
          await adminClient.from("shifts").delete()
            .eq("store_id", store_id).eq("department", dept)
            .eq("user_id", affected_user_id)
            .gte("date", patchStartDate).lte("date", patchEndDate)
            .in("status", ["draft", "published"]);
        }
        // FULL MODE cleanup is already handled above (before the dept loop)

        let bestResult: IterationResult | null = null;
        let fallbackUsed = false;
        let aiStrategiesUsed = false;
        const strategyReport: string[] = [];

        // Use effective dates for iterations (in patch mode, only cover the affected range)
        const iterDates = isPatchMode ? effectiveWeekDates : weekDates;

        // ─── AI Strategy Generation via Gemini 2.5 ───────────────────────
        const deptCoverageForAI = coverageData.filter(c => c.department === dept);
        const totalCoverageHours = weekDates.reduce((sum, dateStr) => {
          const dow = getDayOfWeek(dateStr);
          return sum + deptCoverageForAI.filter(c => c.day_of_week === dow).reduce((s, c) => s + c.min_staff_required, 0);
        }, 0);
        const totalEmployeeHours = deptEmployees.reduce((sum, e) => sum + e.weekly_contract_hours, 0);

        const covByDay = new Map<number, number>();
        for (const c of deptCoverageForAI) {
          covByDay.set(c.day_of_week, (covByDay.get(c.day_of_week) ?? 0) + c.min_staff_required);
        }
        const covSummary = [...covByDay.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([dow, staff]) => `  Giorno ${dow}: ${staff} slot-persona`)
          .join("\n");

        const memoryEntries = [...smartMemory.entries()];
        const goodP = memoryEntries.filter(([, v]) => v > 0).length;
        const badP = memoryEntries.filter(([, v]) => v < 0).length;
        const memorySummary = memoryEntries.length > 0
          ? `MEMORIA STORICA: ${goodP} pattern positivi, ${badP} negativi su ${memoryEntries.length}`
          : "MEMORIA STORICA: nessun dato";

        // Gemini 2.5 AI is MANDATORY — no fallback allowed
        const aiResult = await generateAIStrategies({
          rules,
          employees: deptEmployees.map(e => ({
            user_id: e.user_id,
            department: e.department,
            weekly_contract_hours: e.weekly_contract_hours,
            first_name: (e as any).first_name ?? undefined,
            last_name: (e as any).last_name ?? undefined,
          })),
          coverageSummary: `COPERTURA (${dept}):\n${covSummary}`,
          department: dept,
          smartMemorySummary: memorySummary,
          totalCoverageHours,
          totalEmployeeHours,
          openingHours: openingHoursData,
          allowedTimes: allowedData,
          coverageDetails: deptCoverageForAI.map(c => ({
            day_of_week: c.day_of_week,
            hour_slot: c.hour_slot,
            min_staff_required: c.min_staff_required,
          })),
          employeeConstraints: [...empConstraints.entries()].map(([uid, ec]) => ({
            user_id: uid,
            custom_max_daily_hours: ec.custom_max_daily_hours,
            custom_max_weekly_hours: ec.custom_max_weekly_hours,
            custom_max_split_shifts: ec.custom_max_split_shifts,
            custom_days_off: ec.custom_days_off,
          })),
          availability: availability.filter(a => deptEmployees.some(e => e.user_id === a.user_id)),
          exceptions: allExceptions.filter(ex => deptEmployees.some(e => e.user_id === ex.user_id)),
          approvedRequests: (requestsRes.data ?? []).filter((r: any) => deptEmployees.some(e => e.user_id === r.user_id)).map((r: any) => ({
            user_id: r.user_id,
            request_date: r.request_date,
            request_type: r.request_type,
            selected_hour: r.selected_hour,
          })),
          hourBalances: Object.fromEntries(
            deptEmployees.map(e => [e.user_id, hourBalances.get(e.user_id) ?? 0])
          ),
        });
        const strategies = aiResult.strategies;
        aiStrategiesUsed = true; // Always true — AI is mandatory
        console.log(`[${dept}] Gemini 2.5 AI generated ${strategies.length} strategies`);

        strategyReport.push(`=== ${dept.toUpperCase()} ===`);
        strategyReport.push(`Motore: Gemini 2.5 AI (obbligatorio) — contesto completo JSON inviato`);
        strategyReport.push(`Dati inviati: regole store, orari apertura, entrate/uscite, copertura, ${deptEmployees.length} dipendenti con vincoli/disponibilità/eccezioni/richieste`);
        strategyReport.push(`Dipendenti: ${deptEmployees.length} | Copertura: ${totalCoverageHours}h | Disponibili: ${totalEmployeeHours}h`);
        strategyReport.push(`Strategie AI: ${strategies.length}`);

        let bestStrategyIdx = -1;
        let iterationsRun = 0;
        let adaptationNotes: string[] = [];

        // ─── ADAPTIVE ESCALATION LOOP ──────────────────────────────────
        // Priority: fill gaps FIRST by increasing splits & reducing days off.
        // Round 1: original rules (all strategies)
        // Round 2: spezzati +1
        // Round 3: spezzati +2
        // Round 4: spezzati +1 AND giorni liberi -1
        // Round 5: spezzati +3 (maximum flexibility)
        // Round 6: spezzati +2 AND giorni liberi -1 (last resort)
        const escalationRounds = [
          { label: "Round 1 (regole originali)", daysOffDelta: 0, splitsDelta: 0, stratSlice: strategies.length },
          { label: "Round 2 (spezzati +1)", daysOffDelta: 0, splitsDelta: 1, stratSlice: 10 },
          { label: "Round 3 (spezzati +2)", daysOffDelta: 0, splitsDelta: 2, stratSlice: 10 },
          { label: "Round 4 (spezzati +1, giorni liberi -1)", daysOffDelta: -1, splitsDelta: 1, stratSlice: 10 },
          { label: "Round 5 (spezzati +3)", daysOffDelta: 0, splitsDelta: 3, stratSlice: 8 },
          { label: "Round 6 (spezzati +2, giorni liberi -1)", daysOffDelta: -1, splitsDelta: 2, stratSlice: 8 },
        ];

        for (const round of escalationRounds) {
          if (!isTimeBudgetOk()) break;
          // Skip escalation rounds if we already have a perfect solution (0 violations AND 0 uncovered)
          if (bestResult && round.daysOffDelta === 0 && round.splitsDelta === 0) {
            // This is round 1, always run
          } else if (bestResult) {
            // Only run escalation if current best still has violations or uncovered slots
            const preCheck = postValidateShifts(bestResult.shifts, employees, rules, empConstraints, dept);
            if (preCheck.valid && bestResult.uncoveredSlots.length === 0) break;
          }

          // Create adapted rules for this round
          const adaptedRules = { ...rules };
          if (round.daysOffDelta !== 0) {
            adaptedRules.mandatory_days_off_per_week = Math.max(0, rules.mandatory_days_off_per_week + round.daysOffDelta);
          }
          if (round.splitsDelta > 0) {
            adaptedRules.max_split_shifts_per_employee_per_week = rules.max_split_shifts_per_employee_per_week + round.splitsDelta;
          }

          const roundStrategies = round.daysOffDelta === 0 && round.splitsDelta === 0
            ? strategies
            : strategies.slice(0, round.stratSlice);

          if (round.daysOffDelta !== 0 || round.splitsDelta !== 0) {
            strategyReport.push(`\n🔄 ${round.label}: giorni_liberi=${adaptedRules.mandatory_days_off_per_week}, spezzati_max=${adaptedRules.max_split_shifts_per_employee_per_week}`);
          }

          for (let i = 0; i < roundStrategies.length && isTimeBudgetOk(); i++) {
            const strat = roundStrategies[i];
            if (strat.maxSplits > 0) fallbackUsed = true;
            iterationsRun++;

            const result = runIteration(
              store_id, dept, iterDates, employees, availability,
              allExceptions, coverageData, allowedData, adaptedRules, run.id,
              openingHoursData, hourBalances, empConstraints, strat.maxSplits,
              strat.randomize, partialDayBlocks, smartMemory, strat.preferShort,
              strat.reserveForSplit,
            );

            // Apply auto-correction (iterative, up to 5 passes) to fix remaining violations
            // IMPORTANT: auto-correct with ORIGINAL rules, not adapted — ensures final result always respects base rules
            const { correctedShifts, corrections } = autoCorrectViolations(
              result.shifts, employees, rules, empConstraints, dept, coverageData, weekDates,
            );
            // Apply equity rebalancing pass: equalize days off and splits
            const { rebalancedShifts, equityReport } = equalizeEquity(
              correctedShifts, employees, rules, empConstraints, dept,
              coverageData, weekDates, availability, allExceptions,
              allowedData, openingHoursData,
            );
            // Recompute fitness with equity-rebalanced shifts
            const correctedUncovered: { date: string; hour: string }[] = [];
            for (const dateStr of iterDates) {
              const dow = getDayOfWeek(dateStr);
              const dayCov = coverageData.filter(c => c.department === dept && c.day_of_week === dow);
              for (const c of dayCov) {
                const h = parseInt(c.hour_slot.split(":")[0], 10);
                const assigned = rebalancedShifts.filter(s =>
                  !s.is_day_off && s.date === dateStr && s.department === dept &&
                  s.start_time !== null && s.end_time !== null &&
                  parseHour(s.start_time!) <= h && parseHour(s.end_time!) > h
                ).length;
                if (assigned < c.min_staff_required) {
                  correctedUncovered.push({ date: dateStr, hour: `${String(h).padStart(2, "0")}:00` });
                }
              }
            }
            const correctedFitness = computeFitness(rebalancedShifts, correctedUncovered, employees, coverageData, weekDates, hourBalances, dept);
            const correctedResult: IterationResult = {
              shifts: rebalancedShifts,
              uncoveredSlots: correctedUncovered,
              fitnessScore: correctedFitness.score,
              hourAdjustments: correctedFitness.hourAdjustments,
              dayLogs: [...result.dayLogs, ...equityReport],
            };

            // Track ALL corrections + equity swaps for this candidate
            const candidateValid = postValidateShifts(rebalancedShifts, employees, rules, empConstraints, dept);

            if (!bestResult || correctedResult.fitnessScore > bestResult.fitnessScore) {
              bestResult = correctedResult;
              bestStrategyIdx = i;
              adaptationNotes = [...corrections, ...equityReport.filter(r => r.startsWith("SWAP") || r.startsWith("RIDUZIONE"))];
              if (round.daysOffDelta !== 0 || round.splitsDelta !== 0) {
                adaptationNotes.push(`Adattamento: ${round.label}`);
              }
            }

            // Perfect solution: 0 uncovered, 0 violations, positive fitness
            if (correctedResult.uncoveredSlots.length === 0 && candidateValid.valid && correctedResult.fitnessScore >= 0) {
              strategyReport.push(`✅ #${i + 1} "${strat.description}" PERFETTA (fitness: ${correctedResult.fitnessScore.toFixed(1)})${corrections.length > 0 ? ` [${corrections.length} correzioni auto, ${equityReport.filter(r => r.startsWith("SWAP") || r.startsWith("RIDUZIONE")).length} swap equità]` : ""}`);
              break;
            }
          }

          // If perfect solution found (0 uncovered + 0 violations), stop escalation
          if (bestResult && bestResult.uncoveredSlots.length === 0) {
            const check = postValidateShifts(bestResult.shifts, employees, rules, empConstraints, dept);
            if (check.valid) break;
          }
        }

        // ─── FINAL FORCED CORRECTION ──────────────────────────────────
        // If after all escalation rounds the best solution still has violations,
        // run one final aggressive auto-correction pass to force compliance
        if (bestResult) {
          const finalCheck = postValidateShifts(bestResult.shifts, employees, rules, empConstraints, dept);
          if (!finalCheck.valid) {
            strategyReport.push(`\n⚠️ Soluzione migliore ha ${finalCheck.violations.length} violazioni residue. Correzione forzata finale...`);
            const { correctedShifts, corrections } = autoCorrectViolations(
              bestResult.shifts, employees, rules, empConstraints, dept, coverageData, weekDates,
            );
            // Final equity pass
            const { rebalancedShifts: finalRebalanced, equityReport: finalEquity } = equalizeEquity(
              correctedShifts, employees, rules, empConstraints, dept,
              coverageData, weekDates, availability, allExceptions,
              allowedData, openingHoursData,
            );
            // Recompute uncovered after final correction + equity
            const finalUncovered: { date: string; hour: string }[] = [];
            for (const dateStr of iterDates) {
              const dow = getDayOfWeek(dateStr);
              const dayCov = coverageData.filter(c => c.department === dept && c.day_of_week === dow);
              for (const c of dayCov) {
                const h = parseInt(c.hour_slot.split(":")[0], 10);
                const assigned = finalRebalanced.filter(s =>
                  !s.is_day_off && s.date === dateStr && s.department === dept &&
                  s.start_time !== null && s.end_time !== null &&
                  parseHour(s.start_time!) <= h && parseHour(s.end_time!) > h
                ).length;
                if (assigned < c.min_staff_required) {
                  finalUncovered.push({ date: dateStr, hour: `${String(h).padStart(2, "0")}:00` });
                }
              }
            }
            const finalFitness = computeFitness(finalRebalanced, finalUncovered, employees, coverageData, weekDates, hourBalances, dept);
            bestResult = {
              shifts: finalRebalanced,
              uncoveredSlots: finalUncovered,
              fitnessScore: finalFitness.score,
              hourAdjustments: finalFitness.hourAdjustments,
              dayLogs: [...bestResult.dayLogs, ...finalEquity],
            };
            adaptationNotes.push(...corrections);
            adaptationNotes.push(...finalEquity.filter(r => r.startsWith("SWAP") || r.startsWith("RIDUZIONE")));
            strategyReport.push(`   Correzione forzata: ${corrections.length} correzioni + ${finalEquity.filter(r => r.startsWith("SWAP") || r.startsWith("RIDUZIONE")).length} swap equità`);
            const recheck = postValidateShifts(finalRebalanced, employees, rules, empConstraints, dept);
            if (recheck.valid) {
              strategyReport.push(`   ✅ Tutte le violazioni risolte dopo correzione forzata`);
            } else {
              strategyReport.push(`   ⚠️ ${recheck.violations.length} violazioni irrisolvibili (vincoli troppo stringenti)`);
              for (const v of recheck.violations.slice(0, 5)) strategyReport.push(`      - ${v}`);
            }
          }
        }

        if (bestStrategyIdx >= 0) {
          const w = strategies[Math.min(bestStrategyIdx, strategies.length - 1)];
          strategyReport.push(`\n🏆 Vincente: #${bestStrategyIdx + 1} "${w.description}" (splits=${w.maxSplits} short=${w.preferShort} reserve=${w.reserveForSplit})`);
          strategyReport.push(`   Fitness: ${bestResult!.fitnessScore.toFixed(1)} | Scoperti: ${bestResult!.uncoveredSlots.length} | Iterazioni: ${iterationsRun}`);
        }

        // Log ALL adaptations and corrections in detail
        if (adaptationNotes.length > 0) {
          strategyReport.push(`\n🔧 Auto-correzioni applicate (${adaptationNotes.length}):`);
          for (const n of adaptationNotes) strategyReport.push(`   - ${n}`);
        } else {
          strategyReport.push(`\n✅ Nessuna correzione necessaria — soluzione generata rispetta tutte le regole`);
        }

        // Post-validation (final check)
        const validation = postValidateShifts(bestResult!.shifts, employees, rules, empConstraints, dept);
        if (!validation.valid) {
          strategyReport.push(`⚠️ Violazioni residue: ${validation.violations.length}`);
          for (const v of validation.violations.slice(0, 5)) strategyReport.push(`   - ${v}`);
        } else {
          strategyReport.push(`✅ Post-validazione: tutte le regole rispettate`);
        }

        const { shifts, uncoveredSlots, fitnessScore, hourAdjustments, dayLogs: bestDayLogs } = bestResult!;

        // Insert best shifts
        if (shifts.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < shifts.length; i += batchSize) {
            const batch = shifts.slice(i, i + batchSize);
            const { error: insErr } = await adminClient.from("shifts").insert(batch as any);
            if (insErr) throw new Error(`Insert shifts failed: ${insErr.message}`);
          }
        }

        // Compute optimization suggestions server-side with SPECIFIC corrective actions
        const deptSuggestions: any[] = [];
        const empMapForSugg = new Map(employees.map(e => [e.user_id, e]));
        const { data: profilesForSugg } = await adminClient
          .from("profiles").select("id, full_name").in("id", employees.map(e => e.user_id));
        const nameMap = new Map((profilesForSugg ?? []).map(p => [p.id, p.full_name ?? "Dipendente"]));

        // Helper: find employees who could cover an uncovered slot
        function findCorrectionAlternatives(dateStr: string, uncoveredHour: number, dept: "sala" | "cucina"): any[] {
          const alts: any[] = [];
          const dayShifts = shifts.filter(s => s.date === dateStr && s.department === dept && !s.is_day_off && s.start_time && s.end_time);
          const dow = getDayOfWeek(dateStr);

          // 1) Employees already working that day who could start earlier
          for (const s of dayShifts) {
            const startH = parseInt(s.start_time!.split(":")[0], 10);
            if (startH > uncoveredHour && startH - uncoveredHour <= 2) {
              const empName = nameMap.get(s.user_id) ?? "Dipendente";
              alts.push({
                id: `earlier-${s.user_id}-${dateStr}-${uncoveredHour}`,
                label: `${empName} arriva alle ${uncoveredHour}:00`,
                description: `${empName} anticipa l'entrata da ${s.start_time?.slice(0,5)} a ${uncoveredHour}:00 (${startH - uncoveredHour}h prima)`,
                actionType: "shift_earlier",
                userId: s.user_id,
                userName: empName,
                shiftId: s.generation_run_id ? undefined : undefined, // Will use the shift from DB
                newStartTime: `${String(uncoveredHour).padStart(2,"0")}:00`,
                newEndTime: s.end_time,
              });
            }
          }

          // 2) Employees already working who could stay later
          for (const s of dayShifts) {
            let endH = parseInt(s.end_time!.split(":")[0], 10);
            if (endH === 0) endH = 24;
            if (endH <= uncoveredHour && uncoveredHour - endH <= 2) {
              const empName = nameMap.get(s.user_id) ?? "Dipendente";
              const newEnd = uncoveredHour + 1;
              alts.push({
                id: `later-${s.user_id}-${dateStr}-${uncoveredHour}`,
                label: `${empName} esce alle ${newEnd}:00`,
                description: `${empName} prolunga il turno da ${s.end_time?.slice(0,5)} a ${newEnd}:00 (+${newEnd - endH}h)`,
                actionType: "shift_later",
                userId: s.user_id,
                userName: empName,
                newStartTime: s.start_time,
                newEndTime: `${String(newEnd === 24 ? 0 : newEnd).padStart(2,"0")}:00`,
              });
            }
          }

          // 3) Available employees not working that day — add a shift
          // IMPORTANT: NEVER propose an employee on their day off
          const workingUserIds = new Set(dayShifts.map(s => s.user_id));
          const dayOffUserIds = new Set(
            shifts.filter(s => s.date === dateStr && s.department === dept && s.is_day_off)
              .map(s => s.user_id)
          );
          const deptEmps = employees.filter(e => e.department === dept && e.is_active);
          for (const emp of deptEmps) {
            if (workingUserIds.has(emp.user_id)) continue;
            // Skip employees who have a day off on this date
            if (dayOffUserIds.has(emp.user_id)) continue;
            if (!isAvailable(emp.user_id, dateStr, availability, allExceptions)) continue;
            const empAvail = getAvailableHoursForDay(emp.user_id, dateStr, availability);
            const canCover = empAvail.some(a => uncoveredHour >= a.start && uncoveredHour + 1 <= a.end);
            if (!canCover) continue;
            const empWeeklyUsed = weeklyHours_final.get(emp.user_id) ?? 0;
            if (empWeeklyUsed >= emp.weekly_contract_hours + 5) continue;
            const empName = nameMap.get(emp.user_id) ?? "Dipendente";
            // Find a reasonable shift block
            const nearestEntry = effectiveEntries_final.reduce((best, e) => Math.abs(e - uncoveredHour) < Math.abs(best - uncoveredHour) ? e : best, effectiveEntries_final[0] ?? uncoveredHour);
            const nearestExit = effectiveExits_final.find(e => e > nearestEntry) ?? nearestEntry + 4;
            alts.push({
              id: `split-${emp.user_id}-${dateStr}-${uncoveredHour}`,
              label: `Aggiungi ${empName} (${nearestEntry}:00-${nearestExit}:00)`,
              description: `${empName} (non assegnato) viene a coprire dalle ${nearestEntry}:00 alle ${nearestExit}:00. Ore settimanali: ${empWeeklyUsed}/${emp.weekly_contract_hours}h`,
              actionType: "add_split",
              userId: emp.user_id,
              userName: empName,
              newStartTime: `${String(nearestEntry).padStart(2,"0")}:00`,
              newEndTime: `${String(nearestExit === 24 ? 0 : nearestExit).padStart(2,"0")}:00`,
            });
            if (alts.length >= 5) break;
          }

          // 3b) Propose swapping a day off: employees with day_off TODAY could swap to another day
          if (alts.length < 5) {
            for (const dayOffUserId of dayOffUserIds) {
              if (alts.length >= 5) break;
              const emp = deptEmps.find(e => e.user_id === dayOffUserId);
              if (!emp) continue;
              const empAvail = getAvailableHoursForDay(emp.user_id, dateStr, availability);
              const canCover = empAvail.some(a => uncoveredHour >= a.start && uncoveredHour + 1 <= a.end);
              if (!canCover) continue;
              const empWeeklyUsed = weeklyHours_final.get(emp.user_id) ?? 0;
              if (empWeeklyUsed >= emp.weekly_contract_hours + 5) continue;
              const empName = nameMap.get(emp.user_id) ?? "Dipendente";
              // Find another day this week where this employee works and could take off instead
              const empWorkDays = shifts
                .filter(s => s.user_id === emp.user_id && s.department === dept && !s.is_day_off && s.start_time && s.end_time)
                .map(s => s.date);
              const swapDay = empWorkDays.find(d => {
                const otherUncovered = uncoveredByDay.get(d);
                return !otherUncovered || otherUncovered.length === 0;
              });
              if (!swapDay) continue;
              const swapDayLabel = new Date(swapDay + "T00:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
              const nearestEntry = effectiveEntries_final.reduce((best, e) => Math.abs(e - uncoveredHour) < Math.abs(best - uncoveredHour) ? e : best, effectiveEntries_final[0] ?? uncoveredHour);
              const nearestExit = effectiveExits_final.find(e => e > nearestEntry) ?? nearestEntry + 4;
              alts.push({
                id: `swap-dayoff-${emp.user_id}-${dateStr}-${uncoveredHour}`,
                label: `Sposta riposo ${empName} a ${swapDayLabel}`,
                description: `${empName} sposta il giorno libero da oggi a ${swapDayLabel} e copre ${nearestEntry}:00-${nearestExit}:00. Ore sett.: ${empWeeklyUsed}/${emp.weekly_contract_hours}h`,
                actionType: "add_split",
                userId: emp.user_id,
                userName: empName,
                newStartTime: `${String(nearestEntry).padStart(2,"0")}:00`,
                newEndTime: `${String(nearestExit === 24 ? 0 : nearestExit).padStart(2,"0")}:00`,
              });
            }
          }

          // 4) Employees already working that day who finished early enough for a split
          for (const s of dayShifts) {
            if (alts.length >= 5) break;
            let endH = parseInt(s.end_time!.split(":")[0], 10);
            if (endH === 0) endH = 24;
            // Must have 2h gap: endHour + 2 <= uncoveredHour
            if (endH + 2 > uncoveredHour) continue;
            const emp = deptEmps.find(e => e.user_id === s.user_id);
            if (!emp) continue;
            const empWeeklyUsed = weeklyHours_final.get(emp.user_id) ?? 0;
            if (empWeeklyUsed >= emp.weekly_contract_hours + 5) continue;
            // Check availability for the uncovered hour
            const empAvail = getAvailableHoursForDay(emp.user_id, dateStr, availability);
            const canCover = empAvail.some(a => uncoveredHour >= a.start && uncoveredHour + 1 <= a.end);
            if (!canCover) continue;
            const empName = nameMap.get(emp.user_id) ?? "Dipendente";
            const nearestEntry = effectiveEntries_final.reduce((best, e) => (e >= endH + 2 && Math.abs(e - uncoveredHour) < Math.abs(best - uncoveredHour)) ? e : best, uncoveredHour);
            const nearestExit = effectiveExits_final.find(e => e > nearestEntry) ?? nearestEntry + 4;
            alts.push({
              id: `split-existing-${emp.user_id}-${dateStr}-${uncoveredHour}`,
              label: `Spezzato ${empName} (${nearestEntry}:00-${nearestExit}:00)`,
              description: `${empName} (turno finito alle ${endH}:00) torna per spezzato ${nearestEntry}:00-${nearestExit}:00. Ore sett.: ${empWeeklyUsed}/${emp.weekly_contract_hours}h`,
              actionType: "add_split",
              userId: emp.user_id,
              userName: empName,
              newStartTime: `${String(nearestEntry).padStart(2,"0")}:00`,
              newEndTime: `${String(nearestExit === 24 ? 0 : nearestExit).padStart(2,"0")}:00`,
            });
          }

          // Smart memory: sort alternatives by historical acceptance score (best first)
          alts.sort((a, b) => {
            const aScore = a.userId ? (smartMemory.get(getSmartMemoryKey(a.userId, dow, uncoveredHour)) ?? 0) : 0;
            const bScore = b.userId ? (smartMemory.get(getSmartMemoryKey(b.userId, dow, uncoveredHour)) ?? 0) : 0;
            return bScore - aScore; // Higher score first
          });

          // Cap alternatives to the number of uncovered spots (exact coverage = no overbooking)
          const uncoveredSpotsNeeded = (() => {
            const cov = coverageData.find(c => c.department === dept && c.day_of_week === dow && parseInt(c.hour_slot.split(":")[0], 10) === uncoveredHour);
            if (!cov) return 1;
            const assignedCount = shifts.filter(s => s.date === dateStr && s.department === dept && !s.is_day_off && s.start_time && s.end_time).filter(s => {
              const sh = parseInt(s.start_time!.split(":")[0], 10);
              let eh = parseInt(s.end_time!.split(":")[0], 10);
              if (eh === 0) eh = 24;
              return uncoveredHour >= sh && uncoveredHour < eh;
            }).length;
            return Math.max(1, cov.min_staff_required - assignedCount);
          })();
          return alts.slice(0, uncoveredSpotsNeeded);
        }

        // Track weekly hours from best result for alternative calculations
        const weeklyHours_final = new Map<string, number>();
        for (const s of shifts) {
          if (s.is_day_off || !s.start_time || !s.end_time) continue;
          const dur = parseHour(s.end_time) - parseHour(s.start_time);
          weeklyHours_final.set(s.user_id, (weeklyHours_final.get(s.user_id) ?? 0) + dur);
        }
        const effectiveEntries_final = allowedData
          .filter(t => t.department === dept && t.kind === "entry" && t.is_active)
          .map(t => t.hour).sort((a, b) => a - b);
        const effectiveExits_final = allowedData
          .filter(t => t.department === dept && t.kind === "exit" && t.is_active)
          .map(t => t.hour).sort((a, b) => a - b);

        // Uncovered slot suggestions GROUPED BY DAY (single suggestion per day per dept)
        const uncoveredByDay = new Map<string, number[]>();
        for (const slot of uncoveredSlots) {
          const h = parseInt(slot.hour.split(":")[0], 10);
          const existing = uncoveredByDay.get(slot.date) ?? [];
          existing.push(h);
          uncoveredByDay.set(slot.date, existing);
        }

        for (const [dateStr, hours] of uncoveredByDay) {
          const d = new Date(dateStr + "T00:00:00");
          const dayLabel = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "short" });
          hours.sort((a, b) => a - b);
          const hoursStr = hours.map(h => `${h}:00`).join(", ");

          // Collect alternatives for the FIRST uncovered hour (most actionable)
          const alternatives = findCorrectionAlternatives(dateStr, hours[0], dept);

          // For remaining hours, try to find additional alternatives
          for (let i = 1; i < Math.min(hours.length, 3); i++) {
            const moreAlts = findCorrectionAlternatives(dateStr, hours[i], dept);
            for (const alt of moreAlts) {
              if (alternatives.length < 5 && !alternatives.some(a => a.id === alt.id)) {
                alternatives.push(alt);
              }
            }
          }

          const noAltsMsg = alternatives.length === 0
            ? `Nessuna alternativa interna trovata. Valuta le opzioni "Aumenta spezzati" o prestito inter-store nel pannello sotto.`
            : `${alternatives.length} soluzioni disponibili.`;

          deptSuggestions.push({
            // Canonical ID format for grouped uncovered suggestion: uncov-${dept}-${date}
            id: `uncov-${dept}-${dateStr}`,
            type: "uncovered",
            severity: "critical",
            title: `${hours.length} ore non coperte ${dayLabel} (${dept === "cucina" ? "Cucina" : "Sala"})`,
            description: `Slot scoperti: ${hoursStr}. ${noAltsMsg}`,
            actionLabel: alternatives.length > 0 ? alternatives[0].label : "Vai al giorno",
            declineLabel: alternatives.length > 1 ? "Altra soluzione" : "Ignora",
            date: dateStr,
            slot: `${hours[0]}:00`,
            alternatives,
          });
        }

        // Surplus suggestions with specific details
        const insertedShifts = shifts.filter(s => !s.is_day_off && s.start_time && s.end_time);
        for (const dateStr of iterDates) {
          const dow = getDayOfWeek(dateStr);
          const dayCov = coverageData.filter(c => c.department === dept && c.day_of_week === dow);
          const dayShifts = insertedShifts.filter(s => s.date === dateStr);

          for (const cov of dayCov) {
            const h = parseInt(cov.hour_slot.split(":")[0], 10);
            const coveringShifts: GeneratedShift[] = [];
            for (const s of dayShifts) {
              const sh = parseInt(s.start_time!.split(":")[0], 10);
              let eh = parseInt(s.end_time!.split(":")[0], 10);
              if (eh === 0) eh = 24;
              if (h >= sh && h < eh) coveringShifts.push(s);
            }

            const surplus = coveringShifts.length - cov.min_staff_required;
            if (surplus >= 1) {
              const dayD = new Date(dateStr + "T00:00:00");
              const dayLabel = dayD.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "short" });
              const surplusNames = coveringShifts.slice(-surplus).map(s => nameMap.get(s.user_id) ?? "?").join(", ");

              deptSuggestions.push({
                id: `surplus-${dept}-${dateStr}-${h}`,
                type: "surplus",
                severity: surplus >= 2 ? "warning" : "info",
                title: `${surplus} persona/e in più ${dayLabel} alle ${h}:00`,
                description: `Presenti ${coveringShifts.length} su ${cov.min_staff_required} richiesti. Surplus: ${surplusNames}`,
                actionLabel: "Vedi Dettagli",
                declineLabel: "Ignora",
                date: dateStr,
                slot: `${h}:00`,
                surplusCount: surplus,
                surplusReason: `${coveringShifts.length} presenti vs ${cov.min_staff_required} richiesti alle ${h}:00`,
                alternatives: coveringShifts.slice(-surplus).map(s => {
                  const empName = nameMap.get(s.user_id) ?? "Dipendente";
                  const empBal = hourBalances.get(s.user_id) ?? 0;
                  return {
                    id: `remove-${s.user_id}-${dateStr}-${h}`,
                    label: `Rimuovi turno ${empName}`,
                    description: `${empName} ha ${weeklyHours_final.get(s.user_id) ?? 0}h questa settimana (contratto: ${empMapForSugg.get(s.user_id)?.weekly_contract_hours ?? 40}h, bilancio: ${empBal > 0 ? "+" : ""}${empBal}h)`,
                    actionType: "remove_surplus",
                    userId: s.user_id,
                    userName: empName,
                    shiftId: s.generation_run_id, // reference
                  };
                }),
              });
            }
          }
        }

        // Weekly hour deviation suggestions (only based on THIS generated week, not historical balances)
        for (const emp of deptEmployees) {
          const weeklyUsed = weeklyHours_final.get(emp.user_id) ?? 0;
          const delta = weeklyUsed - emp.weekly_contract_hours;
          // Only flag significant deviations (>=3h) within this generated week
          if (Math.abs(delta) >= 3) {
            const empName = nameMap.get(emp.user_id) ?? "Dipendente";
            const direction = delta > 0 ? "eccesso" : "deficit";
            const absDelta = Math.abs(delta);
            deptSuggestions.push({
              id: `weekdelta-${emp.user_id}`,
              type: "overtime_balance",
              severity: absDelta >= 5 ? "warning" : "info",
              title: `${empName}: ${direction} di ${absDelta}h questa settimana`,
              description: delta > 0
                ? `Assegnate ${weeklyUsed}h su ${emp.weekly_contract_hours}h contratto per questa settimana. Suggerito ridurre di ${Math.min(absDelta, 2)}h.`
                : `Assegnate ${weeklyUsed}h su ${emp.weekly_contract_hours}h contratto per questa settimana. Suggerito aumentare di ${Math.min(absDelta, 2)}h.`,
              actionLabel: delta > 0 ? "Applica Riduzione" : "Applica Aumento",
              declineLabel: "Ignora",
              userId: emp.user_id,
              userName: empName,
              suggestedHours: Math.min(absDelta, 2),
            });
          }
        }

        // ─── Smart post-generation suggestions ─────────────────────────
        // Condition 1: Still uncovered slots AND no internal alternatives left → suggest increase splits
        const uncoveredWithNoAlts = deptSuggestions.filter(
          (s: any) => s.type === "uncovered" && (!s.alternatives || s.alternatives.length === 0)
        );
        if (uncoveredSlots.length > 0 && uncoveredWithNoAlts.length > 0) {
          const currentSplitLimit = rules.max_split_shifts_per_employee_per_week + (fallbackUsed ? 1 : 0);
          deptSuggestions.push({
            id: `smart-increase-splits-${dept}`,
            type: "uncovered",
            severity: "warning",
            title: `Aumentare spezzati a ${currentSplitLimit + 1}/settimana? (${dept === "cucina" ? "Cucina" : "Sala"})`,
            description: `Ci sono ancora ${uncoveredSlots.length} slot scoperti e nessuna alternativa interna disponibile. Aumentando il limite spezzati da ${currentSplitLimit} a ${currentSplitLimit + 1} per dipendente, l'algoritmo potrebbe coprire più slot.`,
            actionLabel: "Sì, aumenta spezzati",
            declineLabel: "No, mantieni limite",
            alternatives: [{
              id: `action-increase-splits-${dept}`,
              label: `Aumenta spezzati a ${currentSplitLimit + 1}`,
              description: `Porta il limite spezzati settimanali da ${currentSplitLimit} a ${currentSplitLimit + 1} per ogni dipendente di ${dept === "cucina" ? "Cucina" : "Sala"} e rigenera i turni.`,
              actionType: "increase_splits",
              suggestedHours: currentSplitLimit + 1,
            }],
          });
        }

        // Condition 2: ALL slots covered AND frequent surplus → suggest increase days off
        if (uncoveredSlots.length === 0) {
          // Count how many surplus slots exist
          const surplusSuggestions = deptSuggestions.filter((s: any) => s.type === "surplus");
          if (surplusSuggestions.length >= 3) {
            const currentDaysOff = rules.mandatory_days_off_per_week;
            deptSuggestions.push({
              id: `smart-increase-daysoff-${dept}`,
              type: "surplus",
              severity: "info",
              title: `Aggiungere +1 giorno libero a testa? (${dept === "cucina" ? "Cucina" : "Sala"})`,
              description: `Tutti gli slot sono coperti e ci sono ${surplusSuggestions.length} slot con surplus. Aumentando i giorni liberi da ${currentDaysOff} a ${currentDaysOff + 1} si riduce il sovraffollamento e si migliora il benessere del team.`,
              actionLabel: "Sì, +1 giorno libero",
              declineLabel: "No, mantieni",
              alternatives: [{
                id: `action-increase-daysoff-${dept}`,
                label: `Porta giorni liberi a ${currentDaysOff + 1}`,
                description: `Aumenta i giorni liberi obbligatori da ${currentDaysOff} a ${currentDaysOff + 1} per ogni dipendente di ${dept === "cucina" ? "Cucina" : "Sala"} per questa settimana e rigenera.`,
                actionType: "increase_days_off",
                suggestedHours: currentDaysOff + 1,
              }],
            });
          }
        }

        // ── Staffing Analysis Suggestion ──
        // Calculate weekly required hours from coverage data
        {
          const deptLabel = dept === "cucina" ? "Cucina" : "Sala";
          const totalWeeklyRequired = weekDates.reduce((sum, dateStr) => {
            const dow = getDayOfWeek(dateStr);
            const dayCov = coverageData.filter(c => c.department === dept && c.day_of_week === dow);
            return sum + dayCov.reduce((s, c) => s + c.min_staff_required, 0);
          }, 0);
          const avgContract = deptEmployees.length > 0
            ? deptEmployees.reduce((s, e) => s + e.weekly_contract_hours, 0) / deptEmployees.length
            : 40;
          const idealCount = Math.ceil(totalWeeklyRequired / avgContract);
          const actualCount = deptEmployees.length;
          const delta = actualCount - idealCount;
          if (delta !== 0) {
            deptSuggestions.push({
              id: `staffing-${dept}`,
              type: "surplus",
              severity: delta < 0 ? "warning" : "info",
              title: delta > 0
                ? `Organico ${deptLabel}: +${delta} rispetto al fabbisogno`
                : `Organico ${deptLabel}: ${delta} rispetto al fabbisogno`,
              description: `Servono ${totalWeeklyRequired}h/settimana (${idealCount} dipendenti ideali a ${Math.round(avgContract)}h). Presenti: ${actualCount}.`,
              actionLabel: "Info",
              declineLabel: "Ok",
              surplusCount: Math.abs(delta),
              surplusReason: delta > 0 ? "Surplus organico" : "Deficit organico",
            });
          }
        }

        // Update run with notes (including AI strategy report) AND suggestions
        const statusNotes = [
          uncoveredSlots.length > 0 ? `${uncoveredSlots.length} slot non coperti` : "Generazione completata",
          `fitness: ${fitnessScore.toFixed(1)}`,
          "Gemini 2.5 AI", // Always AI — no fallback
          fallbackUsed ? "spezzati attivati" : null,
          isPatchMode ? "modalità patch" : null,
        ].filter(Boolean).join(" | ");
        const fullNotes = statusNotes + "\n\n--- REPORT STRATEGIA ---\n" + strategyReport.join("\n") + "\n\n--- LOG GIORNALIERO DETTAGLIATO ---\n" + (bestDayLogs ?? []).join("\n");

        await adminClient.from("generation_runs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          notes: fullNotes,
          fitness_score: fitnessScore,
          iterations_run: iterationsRun,
          hour_adjustments: hourAdjustments,
          suggestions: deptSuggestions,
        } as any).eq("id", run.id);

        results.push({
          department: dept,
          runId: run.id,
          shifts: shifts.filter(s => !s.is_day_off).length,
          daysOff: shifts.filter(s => s.is_day_off).length,
          uncovered: uncoveredSlots.length,
          fitness: fitnessScore,
          hourAdjustments,
          fallbackUsed,
        });
      } catch (genErr) {
        await adminClient.from("generation_runs").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: (genErr as Error).message,
        }).eq("id", run.id);
        throw genErr;
      }
    }

    // ─── Phase 3: Cross-Store Lending Detection (OPTIMIZED) ────────────
    // Pre-fetches ALL data for same-city stores in batch, then processes in-memory.
    // Previous: N×M serial queries (uncovered_slots × other_stores). Now: O(1) batch queries.
    let lendingSuggestionsCreated = 0;

    if (!skip_lending && isTimeBudgetOk()) {
    const { data: currentStore } = await adminClient
      .from("stores").select("id, city").eq("id", store_id).single();
    const storeCity = currentStore?.city;

    if (storeCity) {
      const { data: sameCityStores } = await adminClient
        .from("stores").select("id, name, city")
        .eq("city", storeCity).eq("is_active", true).neq("id", store_id);

      if (sameCityStores && sameCityStores.length > 0) {
        const otherStoreIds = sameCityStores.map(s => s.id);
        const storeNameMap = new Map(sameCityStores.map(s => [s.id, s.name]));

        // ── BATCH PRE-FETCH: all coverage + shifts for all same-city stores ──
        const [batchCovRes, batchShiftsRes] = await Promise.all([
          adminClient.from("store_coverage_requirements").select("*")
            .in("store_id", otherStoreIds),
          adminClient.from("shifts").select("id, user_id, start_time, end_time, is_day_off, department, date, store_id")
            .in("store_id", otherStoreIds)
            .in("status", ["draft", "published"])
            .gte("date", week_start_date).lte("date", weekEnd)
            .eq("is_day_off", false),
        ]);

        const allOtherCoverage = batchCovRes.data ?? [];
        const allOtherShifts = (batchShiftsRes.data ?? []).filter(s => s.start_time && s.end_time);

        // Build in-memory indexes: storeId+dept+dow -> coverage[], storeId+dept+date -> shifts[]
        const covIndex = new Map<string, typeof allOtherCoverage>();
        for (const c of allOtherCoverage) {
          const key = `${c.store_id}|${c.department}|${c.day_of_week}`;
          const arr = covIndex.get(key) ?? [];
          arr.push(c);
          covIndex.set(key, arr);
        }
        const shiftIndex = new Map<string, typeof allOtherShifts>();
        for (const s of allOtherShifts) {
          const key = `${s.store_id}|${s.department}|${s.date}`;
          const arr = shiftIndex.get(key) ?? [];
          arr.push(s);
          shiftIndex.set(key, arr);
        }

        // Helper: count staff at a given hour from pre-indexed shifts
        const countStaffAtHour = (shifts: typeof allOtherShifts, hour: number) => {
          let count = 0;
          const covering: typeof allOtherShifts = [];
          for (const s of shifts) {
            const sh = parseInt(String(s.start_time).split(":")[0], 10);
            let eh = parseInt(String(s.end_time).split(":")[0], 10);
            if (eh === 0) eh = 24;
            if (hour >= sh && hour < eh) { count++; covering.push(s); }
          }
          return { count, covering };
        };

        // ── Collect all uncovered slots (same logic, in-memory) ──
        const allUncoveredByDept = new Map<string, { date: string; hour: number; dept: "sala" | "cucina" }[]>();
        for (const res of results) {
          const dept = res.department as "sala" | "cucina";
          const { data: draftShifts } = await adminClient
            .from("shifts").select("*")
            .eq("store_id", store_id).eq("department", dept)
            .eq("status", "draft").gte("date", week_start_date).lte("date", weekEnd);

          const deptCoverage = coverageData.filter(c => c.department === dept);
          for (const dateStr of weekDates) {
            const dow = getDayOfWeek(dateStr);
            const dayCov = deptCoverage.filter(c => c.day_of_week === dow);
            const dayShifts = (draftShifts ?? []).filter(s => s.date === dateStr && !s.is_day_off && s.start_time && s.end_time);
            for (const cov of dayCov) {
              const h = parseInt(cov.hour_slot.split(":")[0], 10);
              let staffCount = 0;
              for (const s of dayShifts) {
                const sh = parseInt(String(s.start_time).split(":")[0], 10);
                let eh = parseInt(String(s.end_time).split(":")[0], 10);
                if (eh === 0) eh = 24;
                if (h >= sh && h < eh) staffCount++;
              }
              if (staffCount < cov.min_staff_required) {
                const arr = allUncoveredByDept.get(dept) ?? [];
                arr.push({ date: dateStr, hour: h, dept });
                allUncoveredByDept.set(dept, arr);
              }
            }
          }
        }

        // ── Process uncovered slots against pre-fetched data (NO more N×M queries) ──
        // Collect all candidate user IDs for batch profile/stats fetch
        const candidateUserIds = new Set<string>();
        type LendingCandidate = {
          slot: { date: string; hour: number; dept: string };
          otherStoreId: string;
          candidate: typeof allOtherShifts[0];
          surplusCount: number;
          minRequired: number;
          otherStaffCount: number;
        };
        const lendingCandidates: LendingCandidate[] = [];

        for (const [dept, uncoveredSlots] of allUncoveredByDept) {
          for (const slot of uncoveredSlots) {
            const dow = getDayOfWeek(slot.date);
            for (const otherStore of sameCityStores) {
              const covKey = `${otherStore.id}|${dept}|${dow}`;
              const shiftKey = `${otherStore.id}|${dept}|${slot.date}`;
              const otherCov = covIndex.get(covKey) ?? [];
              const otherShifts = shiftIndex.get(shiftKey) ?? [];

              const covForHour = otherCov.find(c => parseInt(c.hour_slot.split(":")[0], 10) === slot.hour);
              const minRequired = covForHour?.min_staff_required ?? 0;
              const { count: otherStaffCount, covering } = countStaffAtHour(otherShifts, slot.hour);

              if (otherStaffCount > minRequired) {
                const surplusCount = otherStaffCount - minRequired;
                for (const s of covering) candidateUserIds.add(s.user_id);
                // Pick first covering shift as candidate (will sort by balance later)
                lendingCandidates.push({
                  slot: { date: slot.date, hour: slot.hour, dept },
                  otherStoreId: otherStore.id,
                  candidate: covering[0],
                  surplusCount,
                  minRequired,
                  otherStaffCount,
                });
                break; // found a store with surplus for this slot
              }
            }
          }
        }

        // Batch-fetch profiles + stats for ALL candidate users at once
        const userIdArr = [...candidateUserIds];
        let balMap = new Map<string, number>();
        let lendNameMap = new Map<string, string>();
        if (userIdArr.length > 0) {
          const [statsRes, profilesRes] = await Promise.all([
            adminClient.from("employee_stats").select("user_id, current_balance, store_id")
              .in("user_id", userIdArr),
            adminClient.from("profiles").select("id, full_name")
              .in("id", userIdArr),
          ]);
          balMap = new Map((statsRes.data ?? []).map(s => [s.user_id, Number(s.current_balance)]));
          lendNameMap = new Map((profilesRes.data ?? []).map(p => [p.id, p.full_name ?? "Dipendente"]));
        }

        // Check existing lending suggestions in batch
        const runIds = results.map(r => r.runId).filter(Boolean);
        let existingSuggestions = new Set<string>();
        if (runIds.length > 0 && lendingCandidates.length > 0) {
          const { data: existing } = await adminClient
            .from("lending_suggestions").select("generation_run_id, user_id, suggested_date")
            .in("generation_run_id", runIds);
          for (const e of (existing ?? [])) {
            existingSuggestions.add(`${e.generation_run_id}|${e.user_id}|${e.suggested_date}`);
          }
        }

        // ── Batch-insert all lending suggestions ──
        const suggestionsToInsert: any[] = [];
        // Track suggestion-run updates to batch at the end
        const runSuggestionUpdates = new Map<string, any[]>(); // runId -> updated suggestions array

        // Pre-load all generation_run suggestions for batch update
        const runSuggestionsCache = new Map<string, any[]>();
        if (runIds.length > 0) {
          const { data: runsData } = await adminClient
            .from("generation_runs").select("id, suggestions").in("id", runIds);
          for (const r of (runsData ?? [])) {
            runSuggestionsCache.set(r.id, (r.suggestions as any[]) ?? []);
          }
        }

        for (const lc of lendingCandidates) {
          const { slot, otherStoreId, candidate, surplusCount, minRequired, otherStaffCount } = lc;
          if (!candidate) continue;

          const candidateName = lendNameMap.get(candidate.user_id) ?? "Dipendente";
          const runId = results.find(r => r.department === slot.dept)?.runId;
          if (!runId) continue;

          const existKey = `${runId}|${candidate.user_id}|${slot.date}`;
          if (existingSuggestions.has(existKey)) continue;
          existingSuggestions.add(existKey); // prevent duplicates within batch

          const otherStoreName = storeNameMap.get(otherStoreId) ?? "Store";

          suggestionsToInsert.push({
            generation_run_id: runId,
            user_id: candidate.user_id,
            source_store_id: otherStoreId,
            target_store_id: store_id,
            department: slot.dept,
            suggested_date: slot.date,
            suggested_start_time: candidate.start_time,
            suggested_end_time: candidate.end_time,
            reason: `${candidateName} da ${otherStoreName} (surplus ${surplusCount} persona/e alle ${slot.hour}:00). Turno: ${String(candidate.start_time).slice(0,5)}-${String(candidate.end_time).slice(0,5)}`,
            status: "pending",
          });

          // Append lending alternative to uncovered suggestion in memory
          const suggs = runSuggestionsCache.get(runId) ?? [];
          const uncovSugg = suggs.find((s: any) => s.id === `uncov-${slot.dept}-${slot.date}`);
          if (uncovSugg && uncovSugg.alternatives) {
            const dayD = new Date(slot.date + "T00:00:00");
            const dayLabel = dayD.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "short" });
            uncovSugg.alternatives.push({
              id: `lending-${candidate.user_id}-${slot.date}-${slot.hour}`,
              label: `Prestito: ${candidateName} da ${otherStoreName}`,
              description: `${candidateName} viene prestato da ${otherStoreName} (${otherStaffCount}/${minRequired} presenti, surplus di ${surplusCount}). Turno: ${String(candidate.start_time).slice(0,5)}-${String(candidate.end_time).slice(0,5)}, ${dayLabel}. Richiede approvazione di entrambi i locali.`,
              actionType: "lending",
              userId: candidate.user_id,
              userName: candidateName,
              sourceStoreId: otherStoreId,
              sourceStoreName: otherStoreName,
              targetStoreId: store_id,
              newStartTime: candidate.start_time,
              newEndTime: candidate.end_time,
            });
            runSuggestionUpdates.set(runId, suggs);
          }
        }

        // Batch insert lending suggestions
        if (suggestionsToInsert.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < suggestionsToInsert.length; i += batchSize) {
            await adminClient.from("lending_suggestions").insert(suggestionsToInsert.slice(i, i + batchSize));
          }
          lendingSuggestionsCreated = suggestionsToInsert.length;
        }

        // Batch update generation_runs suggestions
        const updatePromises: Promise<any>[] = [];
        for (const [runId, suggs] of runSuggestionUpdates) {
          updatePromises.push(
            adminClient.from("generation_runs").update({ suggestions: suggs } as any).eq("id", runId)
          );
        }
        if (updatePromises.length > 0) await Promise.all(updatePromises);

        // ── Surplus detection in other stores (OPTIMIZED: in-memory scan) ──
        const surplusSuggestionsBatch: { runId: string; suggestions: any[] }[] = [];
        const firstRunId = results[0]?.runId;

        if (firstRunId) {
          const baseSuggs = runSuggestionsCache.get(firstRunId) ?? [];
          let modified = false;

          for (const otherStore of sameCityStores) {
            for (const dept of departments) {
              for (const dateStr of weekDates) {
                const dow = getDayOfWeek(dateStr);
                const covKey = `${otherStore.id}|${dept}|${dow}`;
                const shiftKey = `${otherStore.id}|${dept}|${dateStr}`;
                const otherCov = covIndex.get(covKey) ?? [];
                const otherShifts = shiftIndex.get(shiftKey) ?? [];

                for (const cov of otherCov) {
                  const h = parseInt(cov.hour_slot.split(":")[0], 10);
                  const { count } = countStaffAtHour(otherShifts, h);
                  const surplus = count - cov.min_staff_required;
                  if (surplus >= 1) {
                    const existsKey = `other-surplus-${dept}-${otherStore.id}-${dateStr}-${h}`;
                    if (!baseSuggs.find((s: any) => s.id === existsKey)) {
                      const dayD = new Date(dateStr + "T00:00:00");
                      const dayLabel = dayD.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
                      baseSuggs.push({
                        id: existsKey,
                        type: "surplus",
                        severity: "info",
                        title: `${otherStore.name}: ${surplus} in più ${dayLabel} alle ${h}:00`,
                        description: `${otherStore.name} ha ${count} presenti su ${cov.min_staff_required} richiesti (${dept}). Possibile prestito disponibile.`,
                        actionLabel: "Proponi Prestito",
                        declineLabel: "Ignora",
                        date: dateStr,
                        slot: `${h}:00`,
                        surplusCount: surplus,
                        surplusReason: `${otherStore.name}: ${count} presenti vs ${cov.min_staff_required} richiesti`,
                        sourceStoreId: otherStore.id,
                        sourceStoreName: otherStore.name,
                      });
                      modified = true;
                    }
                  }
                }
              }
            }
          }

          if (modified) {
            await adminClient.from("generation_runs").update({ suggestions: baseSuggs } as any).eq("id", firstRunId);
          }
        }
      }
    }
    } // end if (!skip_lending)

    // ─── Phase 4: Patch Mode Notifications ────────────────────────────
    if (isPatchMode && affected_user_id) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const publicAppUrl = Deno.env.get("PUBLIC_APP_URL");

      // Get affected user name
      const { data: affectedProfile } = await adminClient
        .from("profiles").select("full_name").eq("id", affected_user_id).single();
      const affectedName = affectedProfile?.full_name ?? "Dipendente";

      // Get store info
      const { data: storeInfo } = await adminClient
        .from("stores").select("name").eq("id", store_id).single();
      const storeName = storeInfo?.name ?? "Store";

      // Audit log
      await adminClient.from("audit_logs").insert({
        user_id: callerUserId ?? affected_user_id,
        user_name: callerUserId ? (await adminClient.from("profiles").select("full_name").eq("id", callerUserId).single()).data?.full_name : "Sistema",
        action: "patch_regenerate",
        entity_type: "shifts",
        store_id,
        details: {
          description: `Rigenerazione per assenza di ${affectedName} (${exception_start_date ?? "?"} – ${exception_end_date ?? "?"})`,
          affected_user_id,
          affected_user_name: affectedName,
          total_new_shifts: results.reduce((a, r) => a + r.shifts, 0),
        },
      });

      // Send email to store admins
      if (resendKey && publicAppUrl) {
        const { data: storeAdmins } = await adminClient
          .from("user_store_assignments").select("user_id").eq("store_id", store_id);
        const adminUserIds = (storeAdmins ?? []).map(a => a.user_id);

        if (adminUserIds.length > 0) {
          const { data: adminRoles } = await adminClient
            .from("user_roles").select("user_id, role")
            .in("user_id", adminUserIds)
            .in("role", ["admin", "super_admin"]);
          const adminIds = (adminRoles ?? []).map(r => r.user_id);

          if (adminIds.length > 0) {
            const { data: adminProfiles } = await adminClient
              .from("profiles").select("id, email, full_name").in("id", adminIds);

            const totalShifts = results.reduce((a, r) => a + r.shifts, 0);
            const totalUncovered = results.reduce((a, r) => a + r.uncovered, 0);

            for (const admin of (adminProfiles ?? [])) {
              if (!admin.email) continue;
              try {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: "Shift Scheduler <onboarding@resend.dev>",
                    to: [admin.email],
                    subject: `⚠️ Copertura malattia – ${storeName}`,
                    html: `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="padding:40px 36px 16px;text-align:center;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">⚠️ Copertura per Malattia</h1>
<p style="margin:0;font-size:14px;color:#71717a;">${storeName}</p>
</td></tr>
<tr><td style="padding:16px 36px;">
<p style="font-size:14px;color:#18181b;line-height:1.6;">
<strong>${affectedName}</strong> è assente per malattia dal <strong>${exception_start_date ?? "?"}</strong> al <strong>${exception_end_date ?? "?"}</strong>.
</p>
<p style="font-size:14px;color:#18181b;line-height:1.6;">
L'AI ha generato una proposta di copertura con <strong>${totalShifts}</strong> turni redistribuiti${totalUncovered > 0 ? ` (${totalUncovered} slot ancora scoperti)` : ""}.
</p>
<p style="font-size:13px;color:#71717a;margin-top:12px;">
I turni proposti sono in stato <strong>Draft</strong> e richiedono la tua approvazione nel Calendario Team.
</p>
</td></tr>
<tr><td style="padding:24px 36px;text-align:center;">
<a href="${publicAppUrl}/team-calendar" style="display:inline-block;background:#18181b;color:#fff;font-size:14px;font-weight:600;padding:12px 36px;border-radius:10px;text-decoration:none;">Rivedi Proposta</a>
</td></tr></table></td></tr></table></body></html>`,
                  }),
                });
              } catch (emailErr) {
                console.error(`Failed to email admin ${admin.email}:`, emailErr);
              }

              // In-app notification
              try {
                await adminClient.from("notifications").insert({
                  user_id: admin.id,
                  store_id,
                  type: "coverage_problem",
                  title: "Proposta copertura malattia",
                  message: `${affectedName} è assente. L'AI ha generato una proposta con ${totalShifts} turni. Approva nel Calendario Team.`,
                  link: "/team-calendar",
                });
              } catch (notifErr) {
                console.error(`Notification insert failed for admin ${admin.id}:`, notifErr);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      store_id,
      week: { start: week_start_date, end: weekEnd },
      departments: results,
      lending_suggestions_created: lendingSuggestionsCreated,
      is_patch: isPatchMode,
      is_rebalance: isRebalanceMode,
      locked_shifts_kept: lockedShiftIds.size,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-optimized-schedule error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
