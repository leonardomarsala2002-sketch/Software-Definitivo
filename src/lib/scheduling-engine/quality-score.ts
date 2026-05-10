import type {
  ShiftInput,
  RuleViolation,
  QualityMetrics,
  ScheduleContext,
} from "./types";
import { getDayOfWeek, getWeekDates, shiftDuration } from "./hard-rules";

// ─── Metrics calculation ─────────────────────────────────────────────────────

export function calculateMetrics(
  shifts: ShiftInput[],
  hardViolations: RuleViolation[],
  softWarnings: RuleViolation[],
  context: ScheduleContext,
): QualityMetrics {
  const empCount = context.employees.length || 1;

  // Coverage: count exact (date × slot) checks per week, respecting dayOfWeek
  const coverageViolations = hardViolations.filter(v => v.ruleId === "HR001" || v.ruleId === "HR012").length;
  const weekDates = getWeekDates(context.weekStart, context.weekEnd);
  const estimatedCoverageChecks = Math.max(
    context.coverageRequirements.reduce((sum, req) =>
      sum + weekDates.filter(d => getDayOfWeek(d) === req.dayOfWeek).length,
    0),
    1,
  );
  const coverageRespectedPct = Math.max(
    0,
    Math.round(((estimatedCoverageChecks - coverageViolations) / estimatedCoverageChecks) * 100),
  );

  // Contract hours
  const contractViolations = hardViolations.filter(v => v.ruleId === "HR002").length;
  const contractHoursRespectedPct = Math.max(
    0,
    Math.round(((empCount - contractViolations) / empCount) * 100),
  );

  // Approved time-off requests
  const timeOffRuleIds = new Set(["HR003", "HR004", "HR005", "HR006", "HR007", "HR008", "HR009"]);
  const timeOffViolations = hardViolations.filter(v => timeOffRuleIds.has(v.ruleId)).length;
  const totalRequests = context.approvedTimeOff.length || 1;
  const approvedRequestsRespectedPct = Math.max(
    0,
    Math.round(((totalRequests - timeOffViolations) / totalRequests) * 100),
  );

  // Preferences (soft)
  const prefWarnings = softWarnings.filter(w => w.ruleId === "SR001").length;
  const empsWithPrefs = Math.max(context.employees.filter(e => !!e.preferences).length, 1);
  const preferencesRespectedPct = Math.max(
    0,
    Math.round(((empsWithPrefs - Math.min(prefWarnings, empsWithPrefs)) / empsWithPrefs) * 100),
  );

  // Weekend equity: compute variance
  const weekendCounts = context.employees.map(emp =>
    shifts.filter(s => s.userId === emp.id && !s.isDayOff && (getDayOfWeek(s.date) === 5 || getDayOfWeek(s.date) === 6)).length,
  );
  const avgWe = weekendCounts.reduce((a, b) => a + b, 0) / empCount;
  const variance = weekendCounts.reduce((sum, c) => sum + (c - avgWe) ** 2, 0) / empCount;
  const weekendEquityPct = Math.max(0, Math.round(100 - variance * 20));

  // Open/close equity
  const equityWarnings = softWarnings.filter(w => w.ruleId === "SR002").length;
  const openCloseEquityPct = Math.max(0, 100 - equityWarnings * 15);

  // Hour deviation per employee
  const hourDeviationPerEmployee: Record<string, number> = {};
  for (const emp of context.employees) {
    const actual = shifts
      .filter(s => s.userId === emp.id)
      .reduce((sum, s) => sum + shiftDuration(s), 0);
    hourDeviationPerEmployee[emp.id] = parseFloat((actual - emp.contractHoursPerWeek).toFixed(2));
  }

  return {
    coverageRespectedPct,
    contractHoursRespectedPct,
    approvedRequestsRespectedPct,
    preferencesRespectedPct,
    weekendEquityPct,
    openCloseEquityPct,
    hourDeviationPerEmployee,
    hardViolationCount: hardViolations.length,
    softWarningCount: softWarnings.length,
  };
}

// ─── Score calculation ───────────────────────────────────────────────────────

export function calculateQualityScore(metrics: QualityMetrics): number {
  const weighted =
    metrics.coverageRespectedPct * 0.30 +
    metrics.contractHoursRespectedPct * 0.20 +
    metrics.approvedRequestsRespectedPct * 0.20 +
    metrics.preferencesRespectedPct * 0.10 +
    metrics.weekendEquityPct * 0.10 +
    metrics.openCloseEquityPct * 0.10;

  // Each hard violation deducts 15 points (compound)
  const hardPenalty = Math.min(weighted, metrics.hardViolationCount * 15);
  // Each soft warning deducts 2 points
  const softPenalty = Math.min(weighted - hardPenalty, metrics.softWarningCount * 2);

  return Math.max(0, Math.round(weighted - hardPenalty - softPenalty));
}
