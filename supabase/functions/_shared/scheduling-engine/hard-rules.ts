// Deno-compatible copy — identical logic to src/lib/scheduling-engine/hard-rules.ts
// Imports use .ts extension (Deno requirement).

import type { ShiftInput, RuleViolation, ScheduleContext } from "./types.ts";

export function parseHours(t: string): number {
  const parts = t.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] ?? "0", 10);
  return h + m / 60;
}

export function shiftDuration(shift: ShiftInput): number {
  if (shift.isDayOff || !shift.startTime || !shift.endTime) return 0;
  const s = parseHours(shift.startTime);
  let e = parseHours(shift.endTime);
  if (e === 0) e = 24;
  if (e < s) e += 24; // cross-midnight shift (e.g. 22:00–02:00 → 22–26)
  return Math.max(0, e - s);
}

export function getDayOfWeek(date: string): number {
  const d = new Date(date + "T00:00:00Z");
  return (d.getUTCDay() + 6) % 7;
}

export function getWeekDates(weekStart: string, weekEnd: string): string[] {
  const dates: string[] = [];
  const end = new Date(weekEnd + "T00:00:00Z");
  const cur = new Date(weekStart + "T00:00:00Z");
  while (cur <= end) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function coversHour(shift: ShiftInput, slotH: number): boolean {
  if (shift.isDayOff || !shift.startTime || !shift.endTime) return false;
  const s = parseHours(shift.startTime);
  let e = parseHours(shift.endTime);
  if (e === 0) e = 24;
  if (e < s) e += 24; // cross-midnight
  return s <= slotH && e > slotH;
}

export function checkMinimumCoverage(
  shifts: ShiftInput[],
  context: ScheduleContext,
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const dates = getWeekDates(context.weekStart, context.weekEnd);
  const holidays = new Set(context.holidays ?? []);

  for (const req of context.coverageRequirements) {
    const slotH = parseHours(req.hourSlot);
    const matchingDates = dates.filter(d => getDayOfWeek(d) === req.dayOfWeek);

    for (const date of matchingDates) {
      if (holidays.has(date)) continue;
      const count = shifts.filter(
        s => s.date === date && s.department === req.department && coversHour(s, slotH),
      ).length;

      if (count < req.minStaffRequired) {
        violations.push({
          ruleId: "HR001",
          severity: "hard",
          description: `Copertura insufficiente: ${count}/${req.minStaffRequired} in ${req.department} il ${date} alle ${req.hourSlot}`,
          affectedEmployeeId: "",
          affectedDate: date,
          details: { department: req.department, hourSlot: req.hourSlot, required: req.minStaffRequired, actual: count, type: "under" },
        });
      }

      if (req.maxStaffRequired != null && count > req.maxStaffRequired) {
        violations.push({
          ruleId: "HR001",
          severity: "hard",
          description: `Personale in eccesso: ${count}/${req.maxStaffRequired} in ${req.department} il ${date} alle ${req.hourSlot}`,
          affectedEmployeeId: "",
          affectedDate: date,
          details: { department: req.department, hourSlot: req.hourSlot, required: req.maxStaffRequired, actual: count, type: "over" },
        });
      }
    }
  }
  return violations;
}

export function checkContractHours(
  shifts: ShiftInput[],
  context: ScheduleContext,
): RuleViolation[] {
  const tolerance = context.storeRules.contractHoursToleranceH ?? 5;
  const violations: RuleViolation[] = [];

  for (const emp of context.employees) {
    const actualHours = shifts.filter(s => s.userId === emp.id).reduce((sum, s) => sum + shiftDuration(s), 0);
    const deviation = Math.abs(actualHours - emp.contractHoursPerWeek);
    if (deviation > tolerance) {
      violations.push({
        ruleId: "HR002",
        severity: "hard",
        description: `Ore contrattuali violate per ${emp.name}: ${actualHours.toFixed(1)}h vs ${emp.contractHoursPerWeek}h (scostamento ${deviation.toFixed(1)}h > ${tolerance}h)`,
        affectedEmployeeId: emp.id,
        affectedDate: context.weekStart,
        details: { actualHours, targetHours: emp.contractHoursPerWeek, deviation, tolerance },
      });
    }
  }
  return violations;
}

const FULL_DAY_BLOCK_TYPES = new Set(["ferie", "permesso", "permesso_104", "malattia", "giorno_libero"]);
const RULE_ID_MAP: Record<string, string> = { ferie: "HR003", permesso: "HR004", permesso_104: "HR005", malattia: "HR006", giorno_libero: "HR007" };
const LABEL_MAP: Record<string, string> = { ferie: "ferie approvate", permesso: "permesso approvato", permesso_104: "permesso 104 approvato", malattia: "malattia validata", giorno_libero: "giorno libero approvato" };

export function checkTimeOffBlocks(shifts: ShiftInput[], context: ScheduleContext): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const morning = context.storeRules.morningCutoffHour ?? 13;
  const evening = context.storeRules.eveningStartHour ?? 17;

  for (const toff of context.approvedTimeOff) {
    const workShifts = shifts.filter(s => s.userId === toff.userId && s.date === toff.date && !s.isDayOff);
    if (workShifts.length === 0) continue;

    if (FULL_DAY_BLOCK_TYPES.has(toff.type)) {
      for (const s of workShifts) {
        violations.push({
          ruleId: RULE_ID_MAP[toff.type],
          severity: "hard",
          description: `Turno assegnato nonostante ${LABEL_MAP[toff.type]} il ${toff.date}`,
          affectedEmployeeId: toff.userId,
          affectedDate: toff.date,
          details: { timeOffType: toff.type, shiftId: s.id },
        });
      }
    }
    if (toff.type === "mattina_libera") {
      for (const s of workShifts) {
        if (s.startTime && parseHours(s.startTime) < morning) {
          violations.push({ ruleId: "HR008", severity: "hard", description: `Turno mattutino (${s.startTime}) assegnato con mattina libera approvata il ${toff.date}`, affectedEmployeeId: toff.userId, affectedDate: toff.date, details: { startTime: s.startTime, morningCutoff: morning } });
        }
      }
    }
    if (toff.type === "sera_libera") {
      for (const s of workShifts) {
        if (s.startTime && parseHours(s.startTime) >= evening) {
          violations.push({ ruleId: "HR009", severity: "hard", description: `Turno serale (${s.startTime}) assegnato con sera libera approvata il ${toff.date}`, affectedEmployeeId: toff.userId, affectedDate: toff.date, details: { startTime: s.startTime, eveningStart: evening } });
        }
      }
    }
  }
  return violations;
}

export function checkNoOverlaps(shifts: ShiftInput[]): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const byKey = new Map<string, ShiftInput[]>();
  for (const s of shifts) {
    if (s.isDayOff || !s.startTime || !s.endTime) continue;
    const key = `${s.userId}:${s.date}`;
    const arr = byKey.get(key) ?? [];
    arr.push(s);
    byKey.set(key, arr);
  }
  for (const [, dayShifts] of byKey) {
    if (dayShifts.length < 2) continue;
    const sorted = [...dayShifts].sort((a, b) => parseHours(a.startTime!) - parseHours(b.startTime!));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], curr = sorted[i];
      let prevEnd = parseHours(prev.endTime!);
      if (prevEnd === 0) prevEnd = 24;
      if (prevEnd < parseHours(prev.startTime!)) prevEnd += 24; // cross-midnight
      if (parseHours(curr.startTime!) < prevEnd) {
        violations.push({ ruleId: "HR010", severity: "hard", description: `Turni sovrapposti il ${curr.date}: ${prev.startTime}–${prev.endTime} e ${curr.startTime}–${curr.endTime}`, affectedEmployeeId: curr.userId, affectedDate: curr.date, details: { shift1: `${prev.startTime}–${prev.endTime}`, shift2: `${curr.startTime}–${curr.endTime}` } });
      }
    }
  }
  return violations;
}

export function checkMinShiftDuration(shifts: ShiftInput[], context: ScheduleContext): RuleViolation[] {
  const minH = context.storeRules.minShiftHours ?? 3;
  const violations: RuleViolation[] = [];
  for (const s of shifts) {
    if (s.isDayOff || !s.startTime || !s.endTime) continue;
    const dur = shiftDuration(s);
    if (dur < minH) {
      violations.push({ ruleId: "HR011", severity: "hard", description: `Turno troppo corto: ${dur.toFixed(1)}h (minimo ${minH}h) il ${s.date}`, affectedEmployeeId: s.userId, affectedDate: s.date, details: { durationH: dur, minShiftHours: minH } });
    }
  }
  return violations;
}

export function checkHolidayCoverage(shifts: ShiftInput[], context: ScheduleContext): RuleViolation[] {
  if (!context.holidays?.length) return [];
  const violations: RuleViolation[] = [];
  const multiplier = context.storeRules.holidayCoverageMultiplier ?? 1.2;
  for (const holiday of context.holidays) {
    const dow = getDayOfWeek(holiday);
    for (const req of context.coverageRequirements.filter(r => r.dayOfWeek === dow)) {
      const slotH = parseHours(req.hourSlot);
      const requiredWithBonus = Math.ceil(req.minStaffRequired * multiplier);
      const count = shifts.filter(s => s.date === holiday && s.department === req.department && coversHour(s, slotH)).length;
      if (count < requiredWithBonus) {
        violations.push({ ruleId: "HR012", severity: "hard", description: `Copertura festiva insufficiente: ${count}/${requiredWithBonus} in ${req.department} il ${holiday} alle ${req.hourSlot}`, affectedEmployeeId: "", affectedDate: holiday, details: { department: req.department, hourSlot: req.hourSlot, baseRequired: req.minStaffRequired, requiredWithBonus, actual: count, multiplier } });
      }
    }
  }
  return violations;
}

export function runAllHardRules(shifts: ShiftInput[], context: ScheduleContext): RuleViolation[] {
  return [
    ...checkMinimumCoverage(shifts, context),
    ...checkContractHours(shifts, context),
    ...checkTimeOffBlocks(shifts, context),
    ...checkNoOverlaps(shifts),
    ...checkMinShiftDuration(shifts, context),
    ...checkHolidayCoverage(shifts, context),
  ];
}
