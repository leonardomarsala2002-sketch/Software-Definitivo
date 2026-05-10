import type {
  ShiftInput,
  ScheduleContext,
  RuleViolation,
  QualityMetrics,
  EmployeeInfo,
  CoverageRequirement,
  ApprovedTimeOff,
  StoreRules,
  DayOpeningHours,
} from "../scheduling-engine/types";

// ─── Re-export scheduling-engine types used by consumers ─────────────────────

export type {
  ShiftInput,
  ScheduleContext,
  RuleViolation,
  QualityMetrics,
  EmployeeInfo,
  CoverageRequirement,
  ApprovedTimeOff,
  StoreRules,
  DayOpeningHours,
};

// ─── Employee preferences (from employee_preferences table, FASE 3) ──────────

export interface EmployeeAIPreferences {
  preferredShiftType: "morning" | "afternoon" | "evening" | "any" | null;
  preferredDaysOff: string[];
  weekendAvailability: "available" | "unavailable" | "limited";
  prefersOpening: boolean;
  prefersClosing: boolean;
  hourDistribution: "front_loaded" | "even" | "back_loaded" | null;
}

// ─── Raw DB data — what the Edge Function fetches before building AIContext ───

export interface AIRawEmployee {
  id: string;
  name: string;
  department: string;
  weeklyContractHours: number;
  daysOffPerWeek: number;
  preferences?: EmployeeAIPreferences;
}

export interface AIRawData {
  storeId: string;
  storeName?: string;
  weekStart: string;
  weekEnd: string;
  employees: AIRawEmployee[];
  approvedTimeOff: ApprovedTimeOff[];
  coverageRequirements: CoverageRequirement[];
  storeRules: StoreRules;
  openingHours?: DayOpeningHours[];
  recentShifts?: ShiftInput[];
  holidays?: string[];
}

// ─── AI Context — clean, serializable, passed to every feature ───────────────

export interface AIContext extends ScheduleContext {
  storeName?: string;
  employeePreferences: Record<string, EmployeeAIPreferences>;
  storeSummary: {
    totalEmployees: number;
    totalContractHoursPerWeek: number;
    departments: string[];
  };
}

// ─── AI Provider interface ────────────────────────────────────────────────────

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  readonly name: string;
  chat(messages: AIMessage[], options?: ChatOptions): Promise<string>;
}

// ─── AI Proposal — raw output from the AI (before validation) ────────────────

export interface AIShiftProposal {
  userId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isDayOff: boolean;
  department: string;
  reason?: string;
}

export interface AIScheduleProposal {
  shifts: AIShiftProposal[];
  generalReasoning?: string;
  warnings?: string[];
}

// ─── Processed Proposal — after bridge validation ────────────────────────────

export interface ProcessedProposal {
  shifts: ShiftInput[];
  /** userId:date → reason string */
  explanations: Record<string, string>;
  generalReasoning?: string;
  resolvedViolations: RuleViolation[];
  hardViolations: RuleViolation[];
  softWarnings: RuleViolation[];
  qualityScore: number;
  metrics: QualityMetrics;
  aiWarnings?: string[];
  isValid: boolean;
  autoCorrectionsApplied: string[];
}

// ─── Feature names ────────────────────────────────────────────────────────────

export type AIFeatureName =
  | "propose_schedule"
  | "suggest_modifications"
  | "explain_assignment"
  | "suggest_alternatives"
  | "partial_regen"
  | "quality_report"
  | "highlight_criticalities";

// ─── Feature-specific params ──────────────────────────────────────────────────

export interface ProposeScheduleParams {
  notes?: string;
}

export interface SuggestModificationsParams {
  existingShifts: ShiftInput[];
  focusEmployeeIds?: string[];
  notes?: string;
}

export interface ExplainAssignmentParams {
  existingShifts: ShiftInput[];
  employeeId: string;
  date: string;
}

export interface SuggestAlternativesParams {
  existingShifts: ShiftInput[];
  conflictDescription: string;
  affectedEmployeeId?: string;
  affectedDate?: string;
}

export interface PartialRegenParams {
  lockedShifts: ShiftInput[];
  fromDate: string;
  notes?: string;
}

export interface QualityReportParams {
  existingShifts: ShiftInput[];
}

export interface HighlightCriticalitiesParams {
  existingShifts: ShiftInput[];
}

// ─── Feature responses ────────────────────────────────────────────────────────

export interface AITextResponse {
  feature: AIFeatureName;
  text: string;
  structuredData?: Record<string, unknown>;
}

export interface AICriticalityReport {
  feature: AIFeatureName;
  uncoveredSlots: { date: string; hourSlot: string; department: string; shortfall: number }[];
  overloadedEmployees: { employeeId: string; name: string; reason: string }[];
  unsatisfiedRequests: { employeeId: string; name: string; type: string; date: string }[];
  atRiskCoverage: { date: string; hourSlot: string; department: string; currentStaff: number; minRequired: number }[];
  summary: string;
}
