// Deno entry point for the scheduling rule engine.

export type {
  ScheduleStatus,
  TimeOffType,
  RuleSeverity,
  RuleViolation,
  ShiftInput,
  QualityMetrics,
  ValidationResult,
  EmployeePreferences,
  EmployeeInfo,
  CoverageRequirement,
  ApprovedTimeOff,
  StoreRules,
  DayOpeningHours,
  ScheduleContext,
} from "./types.ts";

export {
  parseHours,
  shiftDuration,
  getDayOfWeek,
  getWeekDates,
  checkMinimumCoverage,
  checkContractHours,
  checkTimeOffBlocks,
  checkNoOverlaps,
  checkMinShiftDuration,
  checkHolidayCoverage,
  runAllHardRules,
} from "./hard-rules.ts";

export {
  checkPreferences,
  checkEquity,
  checkHistoricalContinuity,
  checkWorkloadBalance,
  checkHourBankCompensation,
  runAllSoftRules,
} from "./soft-rules.ts";

export { validateSchedule } from "./validator.ts";
export { calculateMetrics, calculateQualityScore } from "./quality-score.ts";
export {
  canTransition,
  transition,
  getAvailableTransitions,
  isPublishable,
  generationRunStatusToLifecycle,
} from "./lifecycle.ts";
