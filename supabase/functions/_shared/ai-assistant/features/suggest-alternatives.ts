import type { AIProvider } from "../providers/base.ts";
import type { AIContext, AIScheduleProposal, SuggestAlternativesParams } from "../types.ts";
import { serializeContextForPrompt } from "../context-builder.ts";
import { extractJSON, SCHEDULE_SYSTEM_PREAMBLE } from "../prompt-utils.ts";

/**
 * Suggests valid alternative shifts when a conflict arises (e.g. employee sick, coverage gap).
 * Returns a revised schedule that resolves the conflict.
 */
export async function suggestAlternatives(
  provider: AIProvider,
  context: AIContext,
  params: SuggestAlternativesParams,
): Promise<AIScheduleProposal> {
  const contextText = serializeContextForPrompt(context);

  const affectedEmp = params.affectedEmployeeId
    ? context.employees.find(e => e.id === params.affectedEmployeeId)
    : null;

  const conflictLines = [
    `Problema da risolvere: ${params.conflictDescription}`,
    affectedEmp ? `Dipendente coinvolto: ${affectedEmp.name}` : "",
    params.affectedDate ? `Data del conflitto: ${params.affectedDate}` : "",
  ].filter(Boolean);

  const currentShiftsText = params.existingShifts
    .filter(s => !s.isDayOff && s.startTime)
    .map(s => {
      const emp = context.employees.find(e => e.id === s.userId);
      return `• ${emp?.name ?? s.userId.slice(0, 8)} il ${s.date}: ${s.startTime}–${s.endTime} (${s.department})`;
    })
    .join("\n");

  const systemPrompt = `${SCHEDULE_SYSTEM_PREAMBLE}

Hai un turno con un problema da risolvere. Proponi le modifiche minime necessarie per risolvere
il conflitto mantenendo la qualità del turno. Modifica solo i turni strettamente necessari.

Restituisci l'intero turno con le correzioni applicate:
{
  "shifts": [ { "userId", "date", "startTime", "endTime", "isDayOff", "department", "reason" } ],
  "generalReasoning": "Come hai risolto il problema",
  "warnings": ["eventuali avvisi residui"]
}`;

  const userLines = [
    contextText,
    `\n--- SITUAZIONE ATTUALE ---`,
    conflictLines.join("\n"),
    `\n--- TURNI CORRENTI ---`,
    currentShiftsText || "(nessun turno ancora pianificato)",
    `\nProponi le alternative valide per risolvere il problema.`,
  ];

  const response = await provider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userLines.join("\n") },
    ],
    { maxTokens: 8000, temperature: 0.4 },
  );

  return extractJSON<AIScheduleProposal>(response);
}
