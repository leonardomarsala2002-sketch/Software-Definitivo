import type { AIProvider } from "../providers/base.ts";
import type { AIContext, AIScheduleProposal, PartialRegenParams } from "../types.ts";
import { serializeContextForPrompt } from "../context-builder.ts";
import { extractJSON, SCHEDULE_SYSTEM_PREAMBLE } from "../prompt-utils.ts";

/**
 * Regenerates only the portion of the week from `fromDate` onward,
 * preserving locked (already-published) shifts unchanged.
 */
export async function partialRegen(
  provider: AIProvider,
  context: AIContext,
  params: PartialRegenParams,
): Promise<AIScheduleProposal> {
  const contextText = serializeContextForPrompt(context);

  const lockedText = params.lockedShifts.length > 0
    ? params.lockedShifts
        .map(s => {
          const emp = context.employees.find(e => e.id === s.userId);
          const name = emp?.name ?? s.userId.slice(0, 8);
          return s.isDayOff
            ? `• ${name} il ${s.date}: RIPOSO (bloccato)`
            : `• ${name} il ${s.date}: ${s.startTime}–${s.endTime} ${s.department} (bloccato)`;
        })
        .join("\n")
    : "(nessun turno bloccato)";

  const systemPrompt = `${SCHEDULE_SYSTEM_PREAMBLE}

Devi rigenerare SOLO la parte di settimana dal ${params.fromDate} in poi.
I turni "bloccati" (già pubblicati) NON devono essere modificati — includili invariati nella risposta.
Genera SOLO i turni mancanti (dal ${params.fromDate} al ${context.weekEnd}).

Tieni conto delle ore già lavorate nei turni bloccati per non sforare il contratto.

Restituisci l'intero turno (bloccati + rigenerati):
{
  "shifts": [ { "userId", "date", "startTime", "endTime", "isDayOff", "department", "reason" } ],
  "generalReasoning": "Spiegazione della rigenerazione parziale",
  "warnings": []
}`;

  const userLines = [
    contextText,
    `\n--- TURNI BLOCCATI (già pubblicati, non modificare) ---`,
    lockedText,
    `\nRigenera i turni dal ${params.fromDate} al ${context.weekEnd}.`,
  ];

  if (params.notes) {
    userLines.push(`Note del manager: ${params.notes}`);
  }

  const response = await provider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userLines.join("\n") },
    ],
    { maxTokens: 8000, temperature: 0.3 },
  );

  return extractJSON<AIScheduleProposal>(response);
}
