// ─── Public API of the AI Assistant Layer ─────────────────────────────────────
// Import from this file only; do not import directly from sub-modules.
//
// Adding a new AI feature:
// 1. Define params/response types in types.ts
// 2. Create features/<feature-name>.ts with the feature function
// 3. Add the feature to the AIFeatureName union in types.ts
// 4. Export the function here
// 5. Wire it in the Edge Function (supabase/functions/ai-assistant/index.ts)

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  AIContext,
  AIRawData,
  AIRawEmployee,
  AIScheduleProposal,
  AIShiftProposal,
  ProcessedProposal,
  AITextResponse,
  AICriticalityReport,
  AIFeatureName,
  EmployeeAIPreferences,
  ProposeScheduleParams,
  SuggestModificationsParams,
  ExplainAssignmentParams,
  SuggestAlternativesParams,
  PartialRegenParams,
  QualityReportParams,
  HighlightCriticalitiesParams,
} from "./types";

// ─── Context ──────────────────────────────────────────────────────────────────
export { buildAIContext, serializeContextForPrompt } from "./context-builder";

// ─── Bridge ───────────────────────────────────────────────────────────────────
export { processAIOutput, describeHardViolations } from "./bridge";

// ─── Providers ────────────────────────────────────────────────────────────────
export type { AIProvider, AIMessage, ChatOptions } from "./providers/base";
export { AnthropicProvider } from "./providers/anthropic";
export { OpenAIProvider } from "./providers/openai";
export { createProvider } from "./providers/index";
export type { ProviderConfig } from "./providers/index";

// ─── Features ────────────────────────────────────────────────────────────────
export { proposeSchedule } from "./features/propose-schedule";
export { suggestModifications } from "./features/suggest-modifications";
export { explainAssignment } from "./features/explain-assignment";
export { suggestAlternatives } from "./features/suggest-alternatives";
export { partialRegen } from "./features/partial-regen";
export { qualityReport } from "./features/quality-report";
export { highlightCriticalities } from "./features/highlight-criticalities";
