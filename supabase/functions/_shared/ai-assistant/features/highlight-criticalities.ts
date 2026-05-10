import type { AIProvider } from "../providers/base";
import type { AIContext, AICriticalityReport, HighlightCriticalitiesParams } from "../types";
import { serializeContextForPrompt } from "../context-builder";
import { validateSchedule } from "../../scheduling-engine/validator";
import { shiftDuration } from "../../scheduling-engine/hard-rules";
import { extractJSON } from "../prompt-utils";

/**
 * Analyzes an existing schedule and highlights critical issues.
 * Combines rule engine hard facts with AI narrative analysis.
 */
export async function highlightCriticalities(
  provider: AIProvider,
  context: AIContext,
  params: HighlightCriticalitiesParams,
): Promise<AICriticalityReport> {
  const contextText = serializeContextForPrompt(context);
  const validation = validateSchedule(params.existingShifts, context);

  // Pre-compute structured facts from rule engine output
  const uncoveredSlots = validation.hardViolations
    .filter(v => v.ruleId === "HR001" || v.ruleId === "HR012")
    .map(v => ({
      date: v.affectedDate,
      hourSlot: (v.details?.hourSlot as string) ?? "",
      department: (v.details?.department as string) ?? "",
      shortfall: ((v.details?.required as number) ?? 0) - ((v.details?.actual as number) ?? 0),
    }));

  const overloadedEmployees = context.employees
    .filter(emp => {
      const actual = params.existingShifts
        .filter(s => s.userId === emp.id)
        .reduce((sum, s) => sum + shiftDuration(s), 0);
      return actual > emp.contractHoursPerWeek + (context.storeRules.contractHoursToleranceH ?? 5);
    })
    .map(emp => {
      const actual = params.existingShifts
        .filter(s => s.userId === emp.id)
        .reduce((sum, s) => sum + shiftDuration(s), 0);
      return {
        employeeId: emp.id,
        name: emp.name,
        reason: `${actual.toFixed(1)}h vs ${emp.contractHoursPerWeek}h contratto`,
      };
    });

  const unsatisfiedRequests = validation.hardViolations
    .filter(v => ["HR003","HR004","HR005","HR006","HR007","HR008","HR009"].includes(v.ruleId))
    .map(v => {
      const emp = context.employees.find(e => e.id === v.affectedEmployeeId);
      const to = context.approvedTimeOff.find(
        t => t.userId === v.affectedEmployeeId && t.date === v.affectedDate,
      );
      return {
        employeeId: v.affectedEmployeeId,
        name: emp?.name ?? v.affectedEmployeeId.slice(0, 8),
        type: to?.type ?? "richiesta",
        date: v.affectedDate,
      };
    });

  const atRiskCoverage = validation.hardViolations
    .filter(v => v.ruleId === "HR001")
    .map(v => ({
      date: v.affectedDate,
      hourSlot: (v.details?.hourSlot as string) ?? "",
      department: (v.details?.department as string) ?? "",
      currentStaff: (v.details?.actual as number) ?? 0,
      minRequired: (v.details?.required as number) ?? 0,
    }));

  // Ask AI to generate a summary based on the structured facts
  const factsText = [
    `Punteggio qualità: ${validation.qualityScore}/100`,
    `Slot scoperti: ${uncoveredSlots.length}`,
    `Dipendenti sovraccarichi: ${overloadedEmployees.length}`,
    `Richieste non rispettate: ${unsatisfiedRequests.length}`,
    `Coperture a rischio: ${atRiskCoverage.length}`,
    validation.hardViolations.length > 0
      ? `Violazioni: ${validation.hardViolations.map(v => `[${v.ruleId}] ${v.description}`).join("; ")}`
      : "Nessuna violazione dura.",
  ].join("\n");

  const systemPrompt = `Sei un assistente per la pianificazione turni. Analizza le criticità del turno
e restituisci un JSON con questo schema esatto:
{
  "summary": "Riassunto delle criticità principali in italiano (max 200 char)"
}
Basati SOLO sui dati forniti, non inventare problemi.`;

  const response = await provider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${contextText}\n\n--- ANALISI RULE ENGINE ---\n${factsText}\n\nGenera il summary.` },
    ],
    { maxTokens: 400, temperature: 0.4 },
  );

  let summary = "Analisi completata.";
  try {
    const parsed = extractJSON<{ summary: string }>(response);
    summary = parsed.summary ?? summary;
  } catch {
    summary = response.trim().slice(0, 300);
  }

  return {
    feature: "highlight_criticalities",
    uncoveredSlots,
    overloadedEmployees,
    unsatisfiedRequests,
    atRiskCoverage,
    summary,
  };
}
