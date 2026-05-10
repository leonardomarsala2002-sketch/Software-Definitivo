import type {
  AIScheduleProposal,
  AIContext,
  ProcessedProposal,
  ShiftInput,
  RuleViolation,
} from "./types";
import { validateSchedule } from "../scheduling-engine/validator";
import { shiftDuration } from "../scheduling-engine/hard-rules";

/**
 * Validates and auto-corrects an AI-proposed schedule.
 * NEVER returns an unvalidated proposal to the caller.
 *
 * Auto-corrections applied (in order):
 * 1. Time-off violations (HR003–HR009): convert conflicting work shifts to day-off
 * 2. Overlapping shifts (HR010): remove the second overlapping shift
 * 3. Too-short shifts (HR011): extend endTime to meet minimum
 *
 * Violations that CANNOT be auto-corrected (returned as hardViolations):
 * - HR001/HR012: coverage gaps (would require adding staff not in the proposal)
 * - HR002: contract hour deviations beyond tolerance
 */
export function processAIOutput(
  proposal: AIScheduleProposal,
  context: AIContext,
): ProcessedProposal {
  const autoCorrectionsApplied: string[] = [];

  // Convert AIShiftProposals to ShiftInput[] (add storeId)
  let shifts: ShiftInput[] = proposal.shifts.map(s => ({
    userId: s.userId,
    storeId: context.storeId,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    isDayOff: s.isDayOff,
    department: s.department,
  }));

  // Build explanation map: "userId:date" → reason
  const explanations: Record<string, string> = {};
  for (const s of proposal.shifts) {
    if (s.reason) {
      explanations[`${s.userId}:${s.date}`] = s.reason;
    }
  }

  // ─── Pass 1: Auto-correct time-off violations (HR003–HR009) ─────────────
  const timeOffRuleIds = new Set(["HR003", "HR004", "HR005", "HR006", "HR007", "HR008", "HR009"]);
  const pass1Result = validateSchedule(shifts, context);
  const timeOffViolations = pass1Result.hardViolations.filter(v => timeOffRuleIds.has(v.ruleId));

  if (timeOffViolations.length > 0) {
    const blockedKeys = new Set(
      timeOffViolations.map(v => `${v.affectedEmployeeId}:${v.affectedDate}`),
    );
    shifts = shifts.map(s => {
      const key = `${s.userId}:${s.date}`;
      if (blockedKeys.has(key) && !s.isDayOff) {
        autoCorrectionsApplied.push(
          `${s.userId.slice(0, 8)} il ${s.date}: turno convertito in riposo (ferie/permesso approvato)`,
        );
        return { ...s, isDayOff: true, startTime: null, endTime: null };
      }
      return s;
    });
  }

  // ─── Pass 2: Auto-correct overlapping shifts (HR010) ────────────────────
  const pass2Result = validateSchedule(shifts, context);
  const overlapViolations = pass2Result.hardViolations.filter(v => v.ruleId === "HR010");

  if (overlapViolations.length > 0) {
    // Build a map to detect duplicates (userId:date → first shift kept)
    const seen = new Map<string, boolean>();
    shifts = shifts.filter(s => {
      if (s.isDayOff || !s.startTime) return true;
      const key = `${s.userId}:${s.date}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        return true;
      }
      autoCorrectionsApplied.push(
        `${s.userId.slice(0, 8)} il ${s.date}: turno duplicato rimosso (sovrapposizione)`,
      );
      return false;
    });
  }

  // ─── Pass 3: Auto-correct too-short shifts (HR011) ──────────────────────
  const minShiftH = context.storeRules.minShiftHours ?? 3;
  const pass3Result = validateSchedule(shifts, context);
  const shortViolations = pass3Result.hardViolations.filter(v => v.ruleId === "HR011");

  if (shortViolations.length > 0) {
    const shortKeys = new Set(
      shortViolations.map(v => `${v.affectedEmployeeId}:${v.affectedDate}`),
    );
    shifts = shifts.map(s => {
      const key = `${s.userId}:${s.date}`;
      if (shortKeys.has(key) && !s.isDayOff && s.startTime && s.endTime) {
        const dur = shiftDuration(s);
        if (dur < minShiftH) {
          // Extend endTime by the difference
          const [h, m] = s.startTime.split(":").map(Number);
          const newEndH = h + minShiftH;
          const newEnd = `${String(newEndH % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          autoCorrectionsApplied.push(
            `${s.userId.slice(0, 8)} il ${s.date}: turno esteso da ${s.endTime} a ${newEnd} (durata minima ${minShiftH}h)`,
          );
          return { ...s, endTime: newEnd };
        }
      }
      return s;
    });
  }

  // ─── Final validation ────────────────────────────────────────────────────
  const finalResult = validateSchedule(shifts, context);

  // Collect resolved violations (those that were in pass1 but not in final)
  const finalHardIds = new Set(
    finalResult.hardViolations.map(v => `${v.ruleId}:${v.affectedEmployeeId}:${v.affectedDate}`),
  );
  const resolvedViolations: RuleViolation[] = pass1Result.hardViolations.filter(
    v => !finalHardIds.has(`${v.ruleId}:${v.affectedEmployeeId}:${v.affectedDate}`),
  );

  return {
    shifts,
    explanations,
    generalReasoning: proposal.generalReasoning,
    resolvedViolations,
    hardViolations: finalResult.hardViolations,
    softWarnings: finalResult.softWarnings,
    qualityScore: finalResult.qualityScore,
    metrics: finalResult.metrics,
    aiWarnings: proposal.warnings,
    isValid: finalResult.isValid,
    autoCorrectionsApplied,
  };
}

/** Describes hard violations in human-readable Italian for error responses. */
export function describeHardViolations(violations: RuleViolation[]): string {
  return violations
    .map(v => `[${v.ruleId}] ${v.description}`)
    .join("\n");
}
