import type { AIProvider } from "../providers/base.ts";
import type { AIContext, AITextResponse, ExplainAssignmentParams, ShiftInput } from "../types.ts";
import { serializeContextForPrompt } from "../context-builder.ts";
import { truncate } from "../prompt-utils.ts";

/**
 * Explains in natural Italian why a specific employee was assigned to a shift.
 * Returns a text response (no validation needed — no shifts are proposed).
 */
export async function explainAssignment(
  provider: AIProvider,
  context: AIContext,
  params: ExplainAssignmentParams,
): Promise<AITextResponse> {
  const shift = params.existingShifts.find(
    s => s.userId === params.employeeId && s.date === params.date,
  );
  const employee = context.employees.find(e => e.id === params.employeeId);

  if (!employee) {
    return {
      feature: "explain_assignment",
      text: "Dipendente non trovato nel contesto.",
    };
  }

  if (!shift) {
    return {
      feature: "explain_assignment",
      text: `Nessun turno trovato per ${employee.name} il ${params.date}.`,
    };
  }

  const shiftDesc = shift.isDayOff
    ? "giorno di riposo"
    : `turno ${shift.startTime}–${shift.endTime} (${shift.department})`;

  // Find time-off for this employee
  const empTimeOff = context.approvedTimeOff
    .filter(to => to.userId === params.employeeId)
    .map(to => `${to.date} (${to.type})`);

  const prefs = context.employeePreferences[params.employeeId];

  const systemPrompt = `Sei un assistente per la pianificazione turni di un negozio italiano.
Spiega in italiano chiaro e conciso (max 150 parole) perché un dipendente è stato assegnato
a uno specifico turno. Considera: ore contrattuali, preferenze, ferie/permessi, coperture richieste.
Rispondi con un paragrafo semplice, senza titoli o elenchi.`;

  const userLines = [
    `Dipendente: ${employee.name}`,
    `Contratto: ${employee.contractHoursPerWeek}h/sett, ${employee.daysOffPerWeek} giorni riposo`,
    `Reparto: ${employee.department}`,
    shift.isDayOff
      ? `Assegnazione il ${params.date}: RIPOSO`
      : `Assegnazione il ${params.date}: ${shift.startTime}–${shift.endTime} (${employee.department})`,
    empTimeOff.length > 0 ? `Ferie/permessi approvati: ${empTimeOff.join(", ")}` : "",
    prefs ? `Preferenze: turno ${prefs.preferredShiftType ?? "any"}, weekend ${prefs.weekendAvailability}` : "",
    `\nSettimana: ${context.weekStart}–${context.weekEnd}`,
    `\nSpiega perché questa assegnazione (${shiftDesc}) è stata scelta per ${employee.name} il ${params.date}.`,
  ].filter(Boolean);

  const response = await provider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userLines.join("\n") },
    ],
    { maxTokens: 400, temperature: 0.5 },
  );

  return {
    feature: "explain_assignment",
    text: truncate(response.trim(), 600),
  };
}
