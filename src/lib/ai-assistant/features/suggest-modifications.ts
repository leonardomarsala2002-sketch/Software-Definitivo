import type { AIProvider } from "../providers/base";
import type { AIContext, AIScheduleProposal, SuggestModificationsParams, ShiftInput } from "../types";
import { serializeContextForPrompt } from "../context-builder";
import { extractJSON, SCHEDULE_SYSTEM_PREAMBLE } from "../prompt-utils";

function serializeShifts(shifts: ShiftInput[]): string {
  const lines = shifts.map(s =>
    s.isDayOff
      ? `• ${s.userId.slice(0, 8)} il ${s.date}: RIPOSO`
      : `• ${s.userId.slice(0, 8)} il ${s.date}: ${s.startTime}–${s.endTime} (${s.department})`,
  );
  return lines.join("\n");
}

/**
 * Suggests improvements to an existing schedule.
 * Returns a full revised schedule (not just the deltas) so the bridge can validate it.
 */
export async function suggestModifications(
  provider: AIProvider,
  context: AIContext,
  params: SuggestModificationsParams,
): Promise<AIScheduleProposal> {
  const contextText = serializeContextForPrompt(context);
  const shiftsText = serializeShifts(params.existingShifts);

  const focusClause = params.focusEmployeeIds && params.focusEmployeeIds.length > 0
    ? `Concentrati sui dipendenti: ${params.focusEmployeeIds.map(id => {
        const emp = context.employees.find(e => e.id === id);
        return emp?.name ?? id.slice(0, 8);
      }).join(", ")}.`
    : "";

  const systemPrompt = `${SCHEDULE_SYSTEM_PREAMBLE}

Il tuo compito è migliorare un turno esistente, non crearne uno da zero.
Identifica problemi (coperture scoperte, ore contrattuali non rispettate, preferenze ignorate)
e proponi modifiche migliorative. ${focusClause}

Restituisci l'intero turno modificato (non solo i delta), nello stesso formato JSON:
{
  "shifts": [ { "userId", "date", "startTime", "endTime", "isDayOff", "department", "reason" } ],
  "generalReasoning": "Quali miglioramenti hai apportato e perché",
  "warnings": ["eventuali avvisi"]
}`;

  const userLines = [
    contextText,
    `\n--- TURNO ATTUALE ---`,
    shiftsText,
    `\nSuggerisci modifiche per migliorare la qualità del turno.`,
  ];

  if (params.notes) {
    userLines.push(`Note del manager: ${params.notes}`);
  }

  const response = await provider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userLines.join("\n") },
    ],
    { maxTokens: 8000, temperature: 0.4 },
  );

  return extractJSON<AIScheduleProposal>(response);
}
