import type { AIProvider } from "../providers/base.ts";
import type { AIContext, AITextResponse, QualityReportParams } from "../types.ts";
import { serializeContextForPrompt } from "../context-builder.ts";
import { validateSchedule } from "../../scheduling-engine/validator.ts";
import { truncate } from "../prompt-utils.ts";

/**
 * Generates a human-readable quality report for an existing schedule.
 * Uses the rule engine's validation result as factual input for the AI narrative.
 */
export async function qualityReport(
  provider: AIProvider,
  context: AIContext,
  params: QualityReportParams,
): Promise<AITextResponse> {
  const contextText = serializeContextForPrompt(context);

  // Run rule engine first — AI uses the factual output as input
  const validation = validateSchedule(params.existingShifts, context);

  const metricsLines = [
    `Punteggio qualità: ${validation.qualityScore}/100`,
    `Copertura rispettata: ${validation.metrics.coverageRespectedPct}%`,
    `Ore contrattuali rispettate: ${validation.metrics.contractHoursRespectedPct}%`,
    `Richieste approvate rispettate: ${validation.metrics.approvedRequestsRespectedPct}%`,
    `Equità weekend: ${validation.metrics.weekendEquityPct}%`,
    `Violazioni dure: ${validation.hardViolations.length}`,
    `Warning soft: ${validation.softWarnings.length}`,
  ];

  const violationsText = validation.hardViolations.length > 0
    ? `\nVIOLAZIONI DURE:\n${validation.hardViolations.map(v => `• [${v.ruleId}] ${v.description}`).join("\n")}`
    : "\nNessuna violazione dura rilevata.";

  const warningsText = validation.softWarnings.length > 0
    ? `\nWARNING SOFT:\n${validation.softWarnings.slice(0, 5).map(v => `• ${v.description}`).join("\n")}`
    : "";

  const systemPrompt = `Sei un assistente per la pianificazione turni di un negozio italiano.
Genera un report narrativo di qualità del turno settimanale in italiano.
Il report deve essere:
- Conciso (max 400 parole)
- Strutturato in 3 sezioni: "Punti di forza", "Criticità", "Suggerimenti per la settimana prossima"
- Basato SUI DATI REALI forniti dal rule engine (non inventare metriche)
- Scritto in italiano chiaro per il manager del negozio`;

  const userLines = [
    contextText,
    `\n--- RISULTATI RULE ENGINE ---`,
    metricsLines.join("\n"),
    violationsText,
    warningsText,
    `\nGenera il report di qualità del turno.`,
  ];

  const response = await provider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userLines.join("\n") },
    ],
    { maxTokens: 1000, temperature: 0.6 },
  );

  return {
    feature: "quality_report",
    text: truncate(response.trim(), 2000),
    structuredData: {
      qualityScore: validation.qualityScore,
      isValid: validation.isValid,
      hardViolationCount: validation.hardViolations.length,
      softWarningCount: validation.softWarnings.length,
      metrics: validation.metrics,
    },
  };
}
