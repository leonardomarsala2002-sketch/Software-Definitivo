import type { AIProvider } from "../providers/base";
import type { AIContext, AIScheduleProposal, ProposeScheduleParams } from "../types";
import { serializeContextForPrompt } from "../context-builder";
import { extractJSON, SCHEDULE_SYSTEM_PREAMBLE } from "../prompt-utils";

const RESPONSE_FORMAT = `{
  "shifts": [
    {
      "userId": "string (ID dipendente)",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM (null se isDayOff=true)",
      "endTime": "HH:MM (null se isDayOff=true)",
      "isDayOff": false,
      "department": "string",
      "reason": "Motivazione breve in italiano (max 80 char)"
    }
  ],
  "generalReasoning": "Spiegazione generale della proposta (max 300 char)",
  "warnings": ["avviso opzionale"]
}`;

/**
 * Generates a full weekly schedule proposal via AI.
 * The returned proposal MUST be passed through processAIOutput() before use.
 */
export async function proposeSchedule(
  provider: AIProvider,
  context: AIContext,
  params?: ProposeScheduleParams,
): Promise<AIScheduleProposal> {
  const contextText = serializeContextForPrompt(context);
  const sr = context.storeRules;

  const systemPrompt = `${SCHEDULE_SYSTEM_PREAMBLE}

SCHEMA RISPOSTA (JSON puro):
${RESPONSE_FORMAT}

Genera UN turno per OGNI dipendente per OGNI giorno della settimana (7 giorni × N dipendenti = N×7 oggetti totali).
Per i giorni di riposo: isDayOff=true, startTime=null, endTime=null.
Ogni dipendente deve avere esattamente ${context.employees[0]?.daysOffPerWeek ?? 2} giorno/i di riposo.`;

  const userLines = [
    contextText,
    `\nVincoli aggiuntivi:`,
    `- Turno min: ${sr.minShiftHours ?? 3}h, max: ${sr.maxShiftHours ?? 10}h`,
    `- Tolleranza ore: ±${sr.contractHoursToleranceH ?? 5}h`,
  ];

  if (params?.notes) {
    userLines.push(`\nNote del manager: ${params.notes}`);
  }

  userLines.push(`\nGenera la proposta di turno per la settimana ${context.weekStart}–${context.weekEnd}.`);

  const response = await provider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userLines.join("\n") },
    ],
    { maxTokens: 8000, temperature: 0.3 },
  );

  return extractJSON<AIScheduleProposal>(response);
}
