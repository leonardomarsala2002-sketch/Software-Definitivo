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
  hourAdjustments: Record<string, number>; // user_id -> delta from contract
}

// Smart memory: historical preference scores per employee+slot
type SmartMemory = Map<string, number>; // key: "userId:dow:hour" -> acceptance score

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

// Fisher-Yates shuffle for randomization across iterations
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Smart Memory Helper ─────────────────────────────────────────────────────

function getSmartMemoryScore(
  userId: string, dow: number, hourCoverage: Map<number, number>, memory: SmartMemory
): number {
  let score = 0;
  for (const [h] of hourCoverage) {
    const key = `${userId}:${dow}:${h}`;
    score += memory.get(key) ?? 0;
  }
  return score;
}

// ─── Fitness Scoring ─────────────────────────────────────────────────────────

const PENALTY_UNCOVERED = -50;   // Heavy penalty per uncovered slot
const PENALTY_OVERCROWDED = -10; // Penalty per overcrowded slot
const PENALTY_DRIFT_PER_H = -5;  // Per hour outside ±5h flexibility
const BONUS_BALANCED = 2;        // Small bonus for balanced distribution

function computeFitness(
  shifts: GeneratedShift[],
  uncoveredSlots: { date: string; hour: string }[],
  employees: EmployeeData[],
  coverage: CoverageReq[],
  weekDates: string[],
  hourBalances: Map<string, number>,
): { score: number; hourAdjustments: Record<string, number> } {
  let score = 0;

  // 1) Uncovered slots penalty
  score += uncoveredSlots.length * PENALTY_UNCOVERED;

  // 2) Overcrowding penalty: check if assigned > required for any slot
  for (const dateStr of weekDates) {
    const dow = getDayOfWeek(dateStr);
    const dayCov = coverage.filter(c => c.day_of_week === dow);
    for (const c of dayCov) {
      const h = parseInt(c.hour_slot.split(":")[0], 10);
      const assigned = shifts.filter(s =>
        !s.is_day_off && s.date === dateStr && s.department === c.department &&
        s.start_time !== null && s.end_time !== null &&
        parseHour(s.start_time!) <= h && parseHour(s.end_time!) > h
      ).length;
      if (assigned > c.min_staff_required) {
        score += (assigned - c.min_staff_required) * PENALTY_OVERCROWDED;
      }
    }
  }

  // 3) Contractual drift penalty & hour adjustments
  const hourAdjustments: Record<string, number> = {};
  const weeklyHoursMap = new Map<string, number>();
  for (const s of shifts) {
    if (s.is_day_off || !s.start_time || !s.end_time) continue;
    const dur = parseHour(s.end_time) - parseHour(s.start_time);
    weeklyHoursMap.set(s.user_id, (weeklyHoursMap.get(s.user_id) ?? 0) + dur);
  }

  for (const emp of employees) {
    const assigned = weeklyHoursMap.get(emp.user_id) ?? 0;
    const balance = hourBalances.get(emp.user_id) ?? 0;
    const target = emp.weekly_contract_hours - balance; // Compensate hour bank
    const delta = assigned - target;
    hourAdjustments[emp.user_id] = delta;

    if (Math.abs(delta) > 5) {
      score += (Math.abs(delta) - 5) * PENALTY_DRIFT_PER_H;
    }
    // Small bonus for being close to target
    if (Math.abs(delta) <= 2) {
      score += BONUS_BALANCED;
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
  randomize: boolean,
  smartMemory: SmartMemory,
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

  const maxDailyTeamHours = department === "sala" ? rules.max_daily_team_hours_sala : rules.max_daily_team_hours_cucina;
  const maxWeeklyTeamHours = department === "sala" ? rules.max_team_hours_sala_per_week : rules.max_team_hours_cucina_per_week;
  let weeklyTeamHoursUsed = 0;

  for (const emp of deptEmployees) {
    weeklyHours.set(emp.user_id, 0);
    daysWorked.set(emp.user_id, new Set());
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
      const worked = daysWorked.get(emp.user_id)!;
      if (worked.size >= (7 - rules.mandatory_days_off_per_week)) return false;
      return true;
    });

    // Key difference: randomize order in iterations for diversity
    if (randomize) {
      availableEmps = shuffle(availableEmps);
    } else {
      // Sort by hours used (least first), with hour bank compensation + smart memory boost
      availableEmps.sort((a, b) => {
        const aUsed = weeklyHours.get(a.user_id) ?? 0;
        const bUsed = weeklyHours.get(b.user_id) ?? 0;
        const aBalance = hourBalances.get(a.user_id) ?? 0;
        const bBalance = hourBalances.get(b.user_id) ?? 0;
        const aTarget = a.weekly_contract_hours - aBalance;
        const bTarget = b.weekly_contract_hours - bBalance;
        const loadRatio = (aUsed / Math.max(aTarget, 1)) - (bUsed / Math.max(bTarget, 1));

        // Smart memory: boost employees historically accepted for this day's slots
        const aMemScore = getSmartMemoryScore(a.user_id, dow, hourCoverage, smartMemory);
        const bMemScore = getSmartMemoryScore(b.user_id, dow, hourCoverage, smartMemory);
        // Higher memory score = more preferred, so subtract to prioritize
        return loadRatio - (aMemScore - bMemScore) * 0.1;
      });
    }

    const staffAssigned = new Map<number, number>();
    for (const [h] of hourCoverage) {
      staffAssigned.set(h, 0);
    }

    for (const emp of availableEmps) {
      const empWeeklyUsed = weeklyHours.get(emp.user_id) ?? 0;
      const balance = hourBalances.get(emp.user_id) ?? 0;
      const adjustedTarget = emp.weekly_contract_hours - balance;
      const maxRemaining = Math.min(
        Math.max(adjustedTarget - empWeeklyUsed, 0),
        rules.max_weekly_hours_per_employee - empWeeklyUsed,
        rules.max_daily_hours_per_employee,
      );
      if (maxRemaining <= 0) continue;
      if (weeklyTeamHoursUsed >= maxWeeklyTeamHours) break;
      if (dailyTeamHoursUsed >= maxDailyTeamHours) break;

      let hasUncovered = false;
      for (const [h, needed] of hourCoverage) {
        if ((staffAssigned.get(h) ?? 0) < needed) { hasUncovered = true; break; }
      }
      if (!hasUncovered) break;

      const empAvail = getAvailableHoursForDay(emp.user_id, dateStr, availability);
      if (empAvail.length === 0) continue;

      const MIN_SHIFT_HOURS = 3;
      let bestStart = -1, bestEnd = -1, bestCoverage = 0;

      for (const entry of effectiveEntries) {
        for (const exit of effectiveExits) {
          if (exit <= entry) continue;
          const duration = exit - entry;
          if (duration < MIN_SHIFT_HOURS) continue; // Minimum 4 hours
          if (duration > maxRemaining || duration > rules.max_daily_hours_per_employee) continue;
          if (dailyTeamHoursUsed + duration > maxDailyTeamHours) continue;

          const withinAvail = empAvail.some(a => entry >= a.start && exit <= a.end);
          if (!withinAvail) continue;

          // Exact coverage: reject shifts that would cause ANY tracked hour to exceed required staff
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

  // Compute fitness
  const { score, hourAdjustments } = computeFitness(shifts, uncoveredSlots, deptEmployees, deptCoverage, weekDates, hourBalances);

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

    const authHeader = req.headers.get("Authorization");
    let callerUserId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      if (token === anonKey || token === serviceRoleKey) {
        callerUserId = null;
      } else {
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
    const { store_id, department, week_start } = body;
    const iterations = body.iterations ?? 40;

    if (!store_id || !department || !week_start) {
      return new Response(JSON.stringify({ error: "store_id, department, week_start required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startD = new Date(week_start + "T00:00:00Z");
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const weekEnd = getDateStr(endD);
    const weekDates = getWeekDates(week_start);

    // Create generation run
    const { data: run, error: runErr } = await adminClient
      .from("generation_runs")
      .insert({
        store_id, department, week_start, week_end: weekEnd,
        status: "running", created_by: callerUserId,
      })
      .select("id")
      .single();

    if (runErr || !run) throw new Error(`Failed to create generation run: ${runErr?.message}`);

    try {
      // Delete existing drafts
      await adminClient.from("shifts").delete()
        .eq("store_id", store_id).eq("department", department)
        .eq("status", "draft").gte("date", week_start).lte("date", weekEnd);

      // Compute 8-week lookback date for smart memory
      const lookbackDate = new Date(week_start + "T00:00:00Z");
      lookbackDate.setUTCDate(lookbackDate.getUTCDate() - 56);
      const lookbackStr = getDateStr(lookbackDate);

      // Fetch all data in parallel (including adjustments & suggestion history)
      const [empRes, availRes, excRes, covRes, allowedRes, rulesRes, ohRes, requestsRes, statsRes, adjRes, outcomesRes] = await Promise.all([
        adminClient.from("employee_details").select("user_id, department, weekly_contract_hours, is_active"),
        adminClient.from("employee_availability").select("user_id, day_of_week, start_time, end_time").eq("store_id", store_id),
        adminClient.from("employee_exceptions").select("user_id, start_date, end_date").eq("store_id", store_id).lte("start_date", weekEnd).gte("end_date", week_start),
        adminClient.from("store_coverage_requirements").select("*").eq("store_id", store_id),
        adminClient.from("store_shift_allowed_times").select("*").eq("store_id", store_id),
        adminClient.from("store_rules").select("*").eq("store_id", store_id).single(),
        adminClient.from("store_opening_hours").select("*").eq("store_id", store_id),
        adminClient.from("time_off_requests").select("user_id, request_date, request_type, selected_hour, status")
          .eq("store_id", store_id).eq("status", "approved").gte("request_date", week_start).lte("request_date", weekEnd),
        adminClient.from("employee_stats").select("user_id, current_balance").eq("store_id", store_id),
        // Accepted adjustments for this week (hour compensation from previous suggestions)
        adminClient.from("generation_adjustments").select("user_id, extra_hours")
          .eq("store_id", store_id).eq("week_start", week_start),
        // Smart memory: suggestion outcomes from last 8 weeks
        adminClient.from("suggestion_outcomes").select("user_id, day_of_week, hour_slot, outcome, department")
          .eq("store_id", store_id).gte("week_start", lookbackStr),
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

      // ─── Hour bank balances + adjustment compensation ──────────────────
      const hourBalances = new Map<string, number>();
      for (const s of (statsRes.data ?? [])) {
        hourBalances.set(s.user_id, Number(s.current_balance));
      }
      // Add accepted adjustments (e.g. +1h last week → -1h this week via balance)
      for (const adj of (adjRes.data ?? [])) {
        const current = hourBalances.get(adj.user_id) ?? 0;
        hourBalances.set(adj.user_id, current + Number(adj.extra_hours));
      }

      // ─── Build Smart Memory from suggestion outcomes ───────────────────
      const smartMemory: SmartMemory = new Map();
      for (const o of (outcomesRes.data ?? [])) {
        if (o.department !== department) continue;
        const key = `${o.user_id}:${o.day_of_week}:${o.hour_slot}`;
        const current = smartMemory.get(key) ?? 0;
        // Accepted outcomes boost score, rejected ones penalize
        if (o.outcome === "accepted") {
          smartMemory.set(key, current + 1);
        } else if (o.outcome === "rejected") {
          smartMemory.set(key, current - 0.5);
        }
      }

      // ─── Run N iterations, keep best ───────────────────────────────────
      let bestResult: IterationResult | null = null;

      for (let i = 0; i < iterations; i++) {
        const result = runIteration(
          store_id, department, weekDates, employees, availability,
          allExceptions, coverageData, allowedData, rules, run.id,
          openingHoursData, hourBalances,
          i > 0, // first iteration is deterministic, rest randomized
          smartMemory,
        );

        if (!bestResult || result.fitnessScore > bestResult.fitnessScore) {
          bestResult = result;
        }

        // Early exit if perfect score (no uncovered, no drift)
        if (result.uncoveredSlots.length === 0 && result.fitnessScore >= 0) break;
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

      // Update hour bank balances
      for (const [userId, delta] of Object.entries(hourAdjustments)) {
        const newBalance = (hourBalances.get(userId) ?? 0) + delta;
        await adminClient.from("employee_stats").upsert({
          user_id: userId,
          store_id,
          current_balance: newBalance,
        }, { onConflict: "user_id,store_id" });
      }

      // Update run
      const notes = uncoveredSlots.length > 0
        ? `${uncoveredSlots.length} slot non coperti (fitness: ${fitnessScore.toFixed(1)})`
        : `Generazione completata con successo (fitness: ${fitnessScore.toFixed(1)})`;

      await adminClient.from("generation_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        notes,
        fitness_score: fitnessScore,
        iterations_run: iterations,
        hour_adjustments: hourAdjustments,
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        ok: true,
        run_id: run.id,
        shifts_created: shifts.filter(s => !s.is_day_off).length,
        days_off_created: shifts.filter(s => s.is_day_off).length,
        uncovered_slots: uncoveredSlots,
        fitness_score: fitnessScore,
        iterations_run: iterations,
        hour_adjustments: hourAdjustments,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (genErr) {
      await adminClient.from("generation_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: (genErr as Error).message,
      }).eq("id", run.id);
      throw genErr;
    }
  } catch (err) {
    console.error("generate-shifts error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
