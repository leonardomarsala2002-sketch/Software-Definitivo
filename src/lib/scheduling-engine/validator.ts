import type { ShiftInput, ScheduleContext, ValidationResult } from "./types";
import { runAllHardRules } from "./hard-rules";
import { runAllSoftRules } from "./soft-rules";
import { calculateMetrics, calculateQualityScore } from "./quality-score";

/**
 * Validates a set of shifts against all hard rules and soft rules.
 *
 * Returns isValid=false when any hard violation is found.
 * Callers MUST block save/publish when isValid is false.
 */
export function validateSchedule(
  shifts: ShiftInput[],
  context: ScheduleContext,
): ValidationResult {
  const hardViolations = runAllHardRules(shifts, context);
  const softWarnings = runAllSoftRules(shifts, context);
  const metrics = calculateMetrics(shifts, hardViolations, softWarnings, context);
  const qualityScore = calculateQualityScore(metrics);

  return {
    isValid: hardViolations.length === 0,
    hardViolations,
    softWarnings,
    qualityScore,
    metrics,
  };
}
