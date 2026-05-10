// Deno-compatible copy — identical logic to src/lib/scheduling-engine/validator.ts

import type { ShiftInput, ScheduleContext, ValidationResult } from "./types.ts";
import { runAllHardRules } from "./hard-rules.ts";
import { runAllSoftRules } from "./soft-rules.ts";
import { calculateMetrics, calculateQualityScore } from "./quality-score.ts";

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
