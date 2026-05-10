// ─── Schedule lifecycle states ──────────────────────────────────────────────

export type ScheduleStatus =
  | "draft"
  | "generated"
  | "validated"
  | "published"
  | "modified"
  | "archived";

// ─── Time-off request types ──────────────────────────────────────────────────

export type TimeOffType =
  | "ferie"
  | "permesso"
  | "permesso_104"
  | "malattia"
  | "giorno_libero"
  | "mattina_libera"
  | "sera_libera";

// ─── Rule violation types ────────────────────────────────────────────────────

export type RuleSeverity = "hard" | "soft";

export interface RuleViolation {
  ruleId: string;
  severity: RuleSeverity;
  description: string;
  /** Empty string when violation is store-level (e.g. coverage) */
  affectedEmployeeId: string;
  affectedDate: string;
  details?: Record<string, unknown>;
}

// ─── Core shift model ────────────────────────────────────────────────────────

export interface ShiftInput {
  id?: string;
  userId: string;
  storeId: string;
  date: string;           // "YYYY-MM-DD"
  startTime: string | null; // "HH:MM" or "HH:MM:SS"
  endTime: string | null;
  isDayOff: boolean;
  department: string;
}

// ─── Validation output ───────────────────────────────────────────────────────

export interface QualityMetrics {
  coverageRespectedPct: number;
  contractHoursRespectedPct: number;
  approvedRequestsRespectedPct: number;
  preferencesRespectedPct: number;
  weekendEquityPct: number;
  openCloseEquityPct: number;
  /** delta hours (actual - target) per employee id */
  hourDeviationPerEmployee: Record<string, number>;
  hardViolationCount: number;
  softWarningCount: number;
}

export interface ValidationResult {
  isValid: boolean;
  hardViolations: RuleViolation[];
  softWarnings: RuleViolation[];
  /** 0–100 composite quality score */
  qualityScore: number;
  metrics: QualityMetrics;
}

// ─── Context objects ─────────────────────────────────────────────────────────

export interface EmployeePreferences {
  preferredShifts?: Array<"morning" | "afternoon" | "evening">;
  /** 0=Mon … 6=Sun */
  preferredDays?: number[];
  avoidDays?: number[];
}

export interface EmployeeInfo {
  id: string;
  name: string;
  department: string;
  contractHoursPerWeek: number;
  daysOffPerWeek: number;
  preferences?: EmployeePreferences;
  /** Current hour-bank balance (positive = extra, negative = deficit) */
  hourBankBalance?: number;
}

export interface CoverageRequirement {
  /** 0=Mon … 6=Sun */
  dayOfWeek: number;
  /** "HH:MM" — start of the coverage slot */
  hourSlot: string;
  department: string;
  minStaffRequired: number;
  maxStaffRequired?: number;
}

export interface ApprovedTimeOff {
  userId: string;
  type: TimeOffType;
  /** "YYYY-MM-DD" — one entry per calendar day */
  date: string;
}

export interface StoreRules {
  /** Minimum work shift length in hours (default 3) */
  minShiftHours?: number;
  /** Maximum work shift length in hours (default 10) */
  maxShiftHours?: number;
  /** Required days off per week (default 1) */
  mandatoryDaysOffPerWeek?: number;
  /** Multiplier applied to minStaffRequired on public holidays (default 1.2) */
  holidayCoverageMultiplier?: number;
  /** Tolerance in hours for contract-hour deviation before hard violation (default 5) */
  contractHoursToleranceH?: number;
  /** Shifts starting before this hour are "morning" (default 13) */
  morningCutoffHour?: number;
  /** Shifts starting at or after this hour are "evening" (default 17) */
  eveningStartHour?: number;
}

export interface DayOpeningHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface ScheduleContext {
  storeId: string;
  weekStart: string; // "YYYY-MM-DD"
  weekEnd: string;
  employees: EmployeeInfo[];
  coverageRequirements: CoverageRequirement[];
  approvedTimeOff: ApprovedTimeOff[];
  storeRules: StoreRules;
  openingHours?: DayOpeningHours[];
  previousWeekShifts?: ShiftInput[];
  /** Public holiday dates in this week — "YYYY-MM-DD" */
  holidays?: string[];
}
