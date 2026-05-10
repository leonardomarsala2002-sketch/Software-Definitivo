// Public API of the scheduling rule engine.
// Import from this file; do not import directly from sub-modules.

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
} from "./types";

export {
  // Hard rules
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
} from "./hard-rules";

export {
  // Soft rules
  checkPreferences,
  checkEquity,
  checkHistoricalContinuity,
  checkWorkloadBalance,
  checkHourBankCompensation,
  runAllSoftRules,
} from "./soft-rules";

export {
  // Validation
  validateSchedule,
} from "./validator";

export {
  // Quality score
  calculateMetrics,
  calculateQualityScore,
} from "./quality-score";

export {
  // Lifecycle
  canTransition,
  transition,
  getAvailableTransitions,
  isPublishable,
  generationRunStatusToLifecycle,
} from "./lifecycle";
