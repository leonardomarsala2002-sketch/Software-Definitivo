import type { ShiftInput, RuleViolation, ScheduleContext } from "./types";
import { getDayOfWeek, parseHours, shiftDuration } from "./hard-rules";

// ─── SR001 — Employee preferences ────────────────────────────────────────────

export function checkPreferences(
  shifts: ShiftInput[],
  context: ScheduleContext,
): RuleViolation[] {
  const warnings: RuleViolation[] = [];
  const morning = context.storeRules.morningCutoffHour ?? 13;
  const evening = context.storeRules.eveningStartHour ?? 17;

  for (const emp of context.employees) {
    if (!emp.preferences) continue;
    const empShifts = shifts.filter(s => s.userId === emp.id && !s.isDayOff && s.startTime);

    for (const s of empShifts) {
      const startH = parseHours(s.startTime!);
      const dow = getDayOfWeek(s.date);

      if (emp.preferences.avoidDays?.includes(dow)) {
        warnings.push({
          ruleId: "SR001",
          severity: "soft",
          description: `Turno in giorno non preferito (${s.date}) per ${emp.name}`,
          affectedEmployeeId: emp.id,
          affectedDate: s.date,
          details: { dow },
        });
      }

      if (emp.preferences.preferredShifts && emp.preferences.preferredShifts.length > 0) {
        let shiftType: "morning" | "afternoon" | "evening";
        if (startH < morning) shiftType = "morning";
        else if (startH < evening) shiftType = "afternoon";
        else shiftType = "evening";

        if (!emp.preferences.preferredShifts.includes(shiftType)) {
          warnings.push({
            ruleId: "SR001",
            severity: "soft",
            description: `Turno di tipo "${shiftType}" non preferito per ${emp.name} il ${s.date}`,
            affectedEmployeeId: emp.id,
            affectedDate: s.date,
            details: { shiftType, preferred: emp.preferences.preferredShifts },
          });
        }
      }
    }
  }

  return warnings;
}

// ─── SR002 — Weekend and equity balance ──────────────────────────────────────

export function checkEquity(
  shifts: ShiftInput[],
  context: ScheduleContext,
): RuleViolation[] {
  const warnings: RuleViolation[] = [];
  const empIds = context.employees.map(e => e.id);
  if (empIds.length < 2) return warnings;

  const weekendCounts: Record<string, number> = {};
  for (const id of empIds) weekendCounts[id] = 0;

  for (const s of shifts) {
    if (s.isDayOff || !empIds.includes(s.userId)) continue;
    const dow = getDayOfWeek(s.date);
    if (dow === 5 || dow === 6) {
      weekendCounts[s.userId] = (weekendCounts[s.userId] ?? 0) + 1;
    }
  }

  const values = Object.values(weekendCounts);
  const maxW = Math.max(...values);
  const minW = Math.min(...values);

  if (maxW - minW > 1) {
    for (const [empId, count] of Object.entries(weekendCounts)) {
      if (count === maxW) {
        const emp = context.employees.find(e => e.id === empId);
        warnings.push({
          ruleId: "SR002",
          severity: "soft",
          description: `Distribuzione weekend non equa: ${emp?.name ?? empId} ha ${count} turni nel weekend vs ${minW} di altri`,
          affectedEmployeeId: empId,
          affectedDate: context.weekStart,
          details: { weekendCount: count, minCount: minW },
        });
      }
    }
  }

  return warnings;
}

// ─── SR003 — Historical continuity ───────────────────────────────────────────

export function checkHistoricalContinuity(
  shifts: ShiftInput[],
  context: ScheduleContext,
): RuleViolation[] {
  if (!context.previousWeekShifts?.length) return [];
  const warnings: RuleViolation[] = [];

  for (const emp of context.employees) {
    const prev = context.previousWeekShifts.filter(s => s.userId === emp.id && !s.isDayOff && s.startTime);
    const curr = shifts.filter(s => s.userId === emp.id && !s.isDayOff && s.startTime);
    if (prev.length === 0 || curr.length === 0) continue;

    const prevAvg = prev.reduce((sum, s) => sum + parseHours(s.startTime!), 0) / prev.length;
    const currAvg = curr.reduce((sum, s) => sum + parseHours(s.startTime!), 0) / curr.length;

    if (Math.abs(currAvg - prevAvg) > 3) {
      warnings.push({
        ruleId: "SR003",
        severity: "soft",
        description: `Grande variazione orari rispetto alla settimana precedente per ${emp.name} (${prevAvg.toFixed(1)}h → ${currAvg.toFixed(1)}h media inizio)`,
        affectedEmployeeId: emp.id,
        affectedDate: context.weekStart,
        details: { prevAvgStart: prevAvg, currAvgStart: currAvg },
      });
    }
  }

  return warnings;
}

// ─── SR004 — Equitable total hours distribution ───────────────────────────────

export function checkWorkloadBalance(
  shifts: ShiftInput[],
  context: ScheduleContext,
): RuleViolation[] {
  const warnings: RuleViolation[] = [];
  const empIds = context.employees.map(e => e.id);
  if (empIds.length < 2) return warnings;

  const hoursByEmp: Record<string, number> = {};
  for (const id of empIds) hoursByEmp[id] = 0;
  for (const s of shifts) {
    if (empIds.includes(s.userId)) {
      hoursByEmp[s.userId] = (hoursByEmp[s.userId] ?? 0) + shiftDuration(s);
    }
  }

  const values = Object.values(hoursByEmp);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const threshold = 6; // warn if >6h above average

  for (const [empId, hours] of Object.entries(hoursByEmp)) {
    if (hours - avg > threshold) {
      const emp = context.employees.find(e => e.id === empId);
      warnings.push({
        ruleId: "SR004",
        severity: "soft",
        description: `Carico di lavoro eccessivo per ${emp?.name ?? empId}: ${hours.toFixed(1)}h vs media ${avg.toFixed(1)}h`,
        affectedEmployeeId: empId,
        affectedDate: context.weekStart,
        details: { hours, average: avg },
      });
    }
  }

  return warnings;
}

// ─── SR006 — Hour bank compensation ──────────────────────────────────────────

export function checkHourBankCompensation(
  shifts: ShiftInput[],
  context: ScheduleContext,
): RuleViolation[] {
  const warnings: RuleViolation[] = [];

  for (const emp of context.employees) {
    if (!emp.hourBankBalance || Math.abs(emp.hourBankBalance) < 2) continue;
    const actual = shifts
      .filter(s => s.userId === emp.id)
      .reduce((sum, s) => sum + shiftDuration(s), 0);
    const expected = emp.contractHoursPerWeek - emp.hourBankBalance;

    if (Math.abs(actual - expected) > 3) {
      warnings.push({
        ruleId: "SR006",
        severity: "soft",
        description: `Banca ore non compensata per ${emp.name}: saldo ${emp.hourBankBalance}h, assegnate ${actual.toFixed(1)}h (attese ${expected.toFixed(1)}h)`,
        affectedEmployeeId: emp.id,
        affectedDate: context.weekStart,
        details: { hourBankBalance: emp.hourBankBalance, actualHours: actual, expectedHours: expected },
      });
    }
  }

  return warnings;
}

// ─── Combined entry point ────────────────────────────────────────────────────

export function runAllSoftRules(
  shifts: ShiftInput[],
  context: ScheduleContext,
): RuleViolation[] {
  return [
    ...checkPreferences(shifts, context),
    ...checkEquity(shifts, context),
    ...checkHistoricalContinuity(shifts, context),
    ...checkWorkloadBalance(shifts, context),
    ...checkHourBankCompensation(shifts, context),
  ];
}
