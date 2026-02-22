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

function isAvailable(emp: string, dateStr: string, availability: AvailSlot[], exceptions: ExceptionBlock[]): boolean {
  for (const ex of exceptions) {
    if (ex.user_id === emp && dateStr >= ex.start_date && dateStr <= ex.end_date) {
      return false;
    }
  }
  const dow = getDayOfWeek(dateStr);
  return availability.some(a => a.user_id === emp && a.day_of_week === dow);
}

function getAvailableHoursForDay(emp: string, dateStr: string, availability: AvailSlot[]): { start: number; end: number }[] {
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
      if (assigned > c.min_staff_required + 1) {
        score += (assigned - c.min_staff_required - 1) * PENALTY_OVERCROWDED;
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

  // 6) EQUITY: penalize days off imbalance (soft)
  const daysOffCounts = new Map<string, number>();
  for (const emp of deptEmployees) {
    const offCount = deptShifts.filter(s => s.user_id === emp.user_id && s.is_day_off).length;
    daysOffCounts.set(emp.user_id, offCount);
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

// ─── Single Iteration Generator ──────────────────────────────────────────────

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
  maxSplitOverride: number,
  randomize: boolean,
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

  for (const dateStr of weekDates) {
    const dow = getDayOfWeek(dateStr);
    const dayCoverage = deptCoverage.filter(c => c.day_of_week === dow);
    if (dayCoverage.length === 0) continue;

    const oh = openingHours.find(h => h.day_of_week === dow);
    const dayOpenH = oh ? parseInt(oh.opening_time.split(":")[0], 10) : 9;
    const dayCloseH = oh ? parseInt(oh.closing_time.split(":")[0], 10) : 22;
    const effectiveClose = dayCloseH === 0 ? 24 : dayCloseH;

    const effectiveEntries = entries.length > 0 ? entries : [dayOpenH];
    const effectiveExits = exits.length > 0 ? exits : [effectiveClose];

    const hourCoverage = new Map<number, number>();
    for (const c of dayCoverage) {
      const h = parseInt(c.hour_slot.split(":")[0], 10);
      hourCoverage.set(h, c.min_staff_required);
    }

    let dailyTeamHoursUsed = 0;

    let availableEmps = deptEmployees.filter(emp => {
      if (!isAvailable(emp.user_id, dateStr, availability, exceptions)) return false;
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

    if (randomize) {
      availableEmps = shuffle(availableEmps);
    } else {
      availableEmps.sort((a, b) => {
        const aUsed = weeklyHours.get(a.user_id) ?? 0;
        const bUsed = weeklyHours.get(b.user_id) ?? 0;
        const aBalance = hourBalances.get(a.user_id) ?? 0;
        const bBalance = hourBalances.get(b.user_id) ?? 0;
        const aTarget = a.weekly_contract_hours - aBalance;
        const bTarget = b.weekly_contract_hours - bBalance;
        return (aUsed / Math.max(aTarget, 1)) - (bUsed / Math.max(bTarget, 1));
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
      const maxRemaining = Math.min(
        Math.max(adjustedTarget - empWeeklyUsed, 0),
        empMaxWeekly - empWeeklyUsed,
        empMaxDaily,
      );
      if (maxRemaining <= 0) continue;
      if (weeklyTeamHoursUsed >= maxWeeklyTeamHours) break;
      if (dailyTeamHoursUsed >= maxDailyTeamHours) break;

      // Check split shift limit
      const empDaySplitCount = dailySplits.get(emp.user_id)?.get(dateStr) ?? 0;
      const empWeeklySplitCount = weeklySplits.get(emp.user_id) ?? 0;
      const maxSplitsWeek = (ec?.custom_max_split_shifts ?? rules.max_split_shifts_per_employee_per_week) + maxSplitOverride;
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

      const empAvail = getAvailableHoursForDay(emp.user_id, dateStr, availability);
      if (empAvail.length === 0) continue;

      let bestStart = -1, bestEnd = -1, bestCoverage = 0;

      for (const entry of effectiveEntries) {
        if (entry < earliestStart) continue;
        for (const exit of effectiveExits) {
          if (exit <= entry) continue;
          const duration = exit - entry;
          if (duration > maxRemaining || duration > empMaxDaily) continue;
          if (dailyTeamHoursUsed + duration > maxDailyTeamHours) continue;

          const withinAvail = empAvail.some(a => entry >= a.start && exit <= a.end);
          if (!withinAvail) continue;

          let coverCount = 0;
          for (let h = entry; h < exit; h++) {
            const needed = hourCoverage.get(h);
            if (needed !== undefined && (staffAssigned.get(h) ?? 0) < needed) coverCount++;
          }

          if (coverCount > bestCoverage || (coverCount === bestCoverage && duration < (bestEnd - bestStart))) {
            bestCoverage = coverCount;
            bestStart = entry;
            bestEnd = exit;
          }
        }
      }

      if (bestStart >= 0 && bestEnd > bestStart) {
        const duration = bestEnd - bestStart;
        const isSplit = empDaySplitCount > 0;

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

    for (const [h, needed] of hourCoverage) {
      if ((staffAssigned.get(h) ?? 0) < needed) {
        uncoveredSlots.push({ date: dateStr, hour: `${String(h).padStart(2, "0")}:00` });
      }
    }
  }

  const { score, hourAdjustments } = computeFitness(shifts, uncoveredSlots, employees, coverage, weekDates, hourBalances, department);

  return { shifts, uncoveredSlots, fitnessScore: score, hourAdjustments };
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
    const { store_id, week_start_date } = body;
    const MAX_ITERATIONS = 40;

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
      adminClient.from("employee_details").select("user_id, department, weekly_contract_hours, is_active"),
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
    const approvedRequests = (requestsRes.data ?? []).map((r: any) => ({
      user_id: r.user_id, start_date: r.request_date, end_date: r.request_date,
    }));
    const allExceptions = [...baseExceptions, ...approvedRequests];

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

    const empConstraints = new Map<string, EmployeeConstraints>();
    for (const c of (constraintsRes.data ?? [])) {
      empConstraints.set(c.user_id, c as EmployeeConstraints);
    }

    // Run for BOTH departments
    const departments: ("sala" | "cucina")[] = ["sala", "cucina"];
    const results: { department: string; runId: string; shifts: number; daysOff: number; uncovered: number; fitness: number; hourAdjustments: Record<string, number>; fallbackUsed: boolean }[] = [];

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
        // Delete existing drafts for this dept
        await adminClient.from("shifts").delete()
          .eq("store_id", store_id).eq("department", dept)
          .eq("status", "draft").gte("date", week_start_date).lte("date", weekEnd);

        let bestResult: IterationResult | null = null;
        let fallbackUsed = false;
        let splitOverride = 0;

        // Phase 1: Normal 40 iterations
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const result = runIteration(
            store_id, dept, weekDates, employees, availability,
            allExceptions, coverageData, allowedData, rules, run.id,
            openingHoursData, hourBalances, empConstraints, splitOverride,
            i > 0,
          );

          if (!bestResult || result.fitnessScore > bestResult.fitnessScore) {
            bestResult = result;
          }

          if (result.uncoveredSlots.length === 0 && result.fitnessScore >= 0) break;
        }

        // Phase 2: Fallback - if still uncovered, increase split limit by 1 and retry
        if (bestResult && bestResult.uncoveredSlots.length > 0) {
          splitOverride = 1;
          fallbackUsed = true;
          console.log(`[${dept}] Fallback: increasing split limit by +1, retrying ${MAX_ITERATIONS} iterations`);

          for (let i = 0; i < MAX_ITERATIONS; i++) {
            const result = runIteration(
              store_id, dept, weekDates, employees, availability,
              allExceptions, coverageData, allowedData, rules, run.id,
              openingHoursData, hourBalances, empConstraints, splitOverride,
              true,
            );

            if (result.fitnessScore > bestResult!.fitnessScore) {
              bestResult = result;
            }

            if (result.uncoveredSlots.length === 0 && result.fitnessScore >= 0) break;
          }
        }

        const { shifts, uncoveredSlots, fitnessScore, hourAdjustments } = bestResult!;

        // Insert best shifts
        if (shifts.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < shifts.length; i += batchSize) {
            const batch = shifts.slice(i, i + batchSize);
            const { error: insErr } = await adminClient.from("shifts").insert(batch as any);
            if (insErr) throw new Error(`Insert shifts failed: ${insErr.message}`);
          }
        }

        // Update run
        const notes = [
          uncoveredSlots.length > 0 ? `${uncoveredSlots.length} slot non coperti` : "Generazione completata",
          `fitness: ${fitnessScore.toFixed(1)}`,
          fallbackUsed ? "fallback spezzati +1 attivato" : null,
        ].filter(Boolean).join(" | ");

        await adminClient.from("generation_runs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          notes,
          fitness_score: fitnessScore,
          iterations_run: fallbackUsed ? MAX_ITERATIONS * 2 : MAX_ITERATIONS,
          hour_adjustments: hourAdjustments,
        }).eq("id", run.id);

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

    return new Response(JSON.stringify({
      ok: true,
      store_id,
      week: { start: week_start_date, end: weekEnd },
      departments: results,
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
