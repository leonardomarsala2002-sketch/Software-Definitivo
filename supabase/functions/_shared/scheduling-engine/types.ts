// Deno-compatible copy — identical to src/lib/scheduling-engine/types.ts
// (no imports from other engine files; used as a base by all other engine modules)

export type ScheduleStatus =
  | "draft"
  | "generated"
  | "validated"
  | "published"
  | "modified"
  | "archived";

export type TimeOffType =
  | "ferie"
  | "permesso"
  | "permesso_104"
  | "malattia"
  | "giorno_libero"
  | "mattina_libera"
  | "sera_libera";

export type RuleSeverity = "hard" | "soft";

export interface RuleViolation {
  ruleId: string;
  severity: RuleSeverity;
  description: string;
  affectedEmployeeId: string;
  affectedDate: string;
  details?: Record<string, unknown>;
}

export interface ShiftInput {
  id?: string;
  userId: string;
  storeId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isDayOff: boolean;
  department: string;
}

export interface QualityMetrics {
  coverageRespectedPct: number;
  contractHoursRespectedPct: number;
  approvedRequestsRespectedPct: number;
  preferencesRespectedPct: number;
  weekendEquityPct: number;
  openCloseEquityPct: number;
  hourDeviationPerEmployee: Record<string, number>;
  hardViolationCount: number;
  softWarningCount: number;
}

export interface ValidationResult {
  isValid: boolean;
  hardViolations: RuleViolation[];
  softWarnings: RuleViolation[];
  qualityScore: number;
  metrics: QualityMetrics;
}

export interface EmployeePreferences {
  preferredShifts?: Array<"morning" | "afternoon" | "evening">;
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
  hourBankBalance?: number;
}

export interface CoverageRequirement {
  dayOfWeek: number;
  hourSlot: string;
  department: string;
  minStaffRequired: number;
  maxStaffRequired?: number;
}

export interface ApprovedTimeOff {
  userId: string;
  type: TimeOffType;
  date: string;
}

export interface StoreRules {
  minShiftHours?: number;
  maxShiftHours?: number;
  mandatoryDaysOffPerWeek?: number;
  holidayCoverageMultiplier?: number;
  contractHoursToleranceH?: number;
  morningCutoffHour?: number;
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
  weekStart: string;
  weekEnd: string;
  employees: EmployeeInfo[];
  coverageRequirements: CoverageRequirement[];
  approvedTimeOff: ApprovedTimeOff[];
  storeRules: StoreRules;
  openingHours?: DayOpeningHours[];
  previousWeekShifts?: ShiftInput[];
  holidays?: string[];
}
