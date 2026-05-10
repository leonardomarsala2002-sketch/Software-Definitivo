import type {
  AIRawData,
  AIContext,
  EmployeeAIPreferences,
} from "./types.ts";
import type { EmployeeInfo } from "../scheduling-engine/types.ts";

/**
 * Builds a clean, serializable AIContext from raw DB data.
 * Pure function — no DB access. All data must be pre-fetched by the caller.
 * Sensitive data (emails, fiscal codes, addresses) is never included.
 */
export function buildAIContext(raw: AIRawData): AIContext {
  const employees: EmployeeInfo[] = raw.employees.map(emp => ({
    id: emp.id,
    name: emp.name,
    department: emp.department,
    contractHoursPerWeek: emp.weeklyContractHours,
    daysOffPerWeek: emp.daysOffPerWeek,
    preferences: emp.preferences
      ? {
          preferredShifts: resolvePreferredShifts(emp.preferences),
          preferredDays: resolvePreferredDays(emp.preferences),
          avoidDays: resolveAvoidDays(emp.preferences),
        }
      : undefined,
  }));

  const employeePreferences: Record<string, EmployeeAIPreferences> = {};
  for (const emp of raw.employees) {
    if (emp.preferences) {
      employeePreferences[emp.id] = emp.preferences;
    }
  }

  const departments = [...new Set(raw.employees.map(e => e.department))];
  const totalContractHoursPerWeek = raw.employees.reduce(
    (sum, e) => sum + e.weeklyContractHours,
    0,
  );

  return {
    storeId: raw.storeId,
    storeName: raw.storeName,
    weekStart: raw.weekStart,
    weekEnd: raw.weekEnd,
    employees,
    coverageRequirements: raw.coverageRequirements,
    approvedTimeOff: raw.approvedTimeOff,
    storeRules: raw.storeRules,
    openingHours: raw.openingHours,
    previousWeekShifts: raw.recentShifts,
    holidays: raw.holidays ?? [],
    employeePreferences,
    storeSummary: {
      totalEmployees: raw.employees.length,
      totalContractHoursPerWeek,
      departments,
    },
  };
}

function resolvePreferredShifts(
  prefs: EmployeeAIPreferences,
): Array<"morning" | "afternoon" | "evening"> | undefined {
  const type = prefs.preferredShiftType;
  if (!type || type === "any") return undefined;
  return [type as "morning" | "afternoon" | "evening"];
}

function resolvePreferredDays(prefs: EmployeeAIPreferences): number[] | undefined {
  const days = prefs.preferredDaysOff;
  if (!days || days.length === 0) return undefined;
  // preferredDaysOff maps to days OFF → we DON'T prefer these for work
  return undefined;
}

function resolveAvoidDays(prefs: EmployeeAIPreferences): number[] | undefined {
  const wa = prefs.weekendAvailability;
  if (wa === "unavailable") return [5, 6]; // Sat=5, Sun=6
  if (wa === "limited") return [6]; // avoid Sunday
  return undefined;
}

// ─── Context serialization for prompts ───────────────────────────────────────

/** Returns a concise text representation of the context, safe for inclusion in prompts. */
export function serializeContextForPrompt(ctx: AIContext): string {
  const lines: string[] = [];

  lines.push(`=== NEGOZIO: ${ctx.storeName ?? ctx.storeId} ===`);
  lines.push(`Settimana: ${ctx.weekStart} → ${ctx.weekEnd}`);
  if (ctx.holidays && ctx.holidays.length > 0) {
    lines.push(`Festività: ${ctx.holidays.join(", ")}`);
  }

  lines.push(`\n--- REGOLE NEGOZIO ---`);
  const sr = ctx.storeRules;
  lines.push(`Turno minimo: ${sr.minShiftHours ?? 3}h, massimo: ${sr.maxShiftHours ?? 10}h`);
  lines.push(`Tolleranza ore contrattuali: ±${sr.contractHoursToleranceH ?? 5}h`);

  lines.push(`\n--- DIPENDENTI (${ctx.employees.length}) ---`);
  for (const emp of ctx.employees) {
    const prefs = ctx.employeePreferences[emp.id];
    let prefStr = "";
    if (prefs) {
      const parts: string[] = [];
      if (prefs.preferredShiftType && prefs.preferredShiftType !== "any") {
        parts.push(`preferisce turno ${prefs.preferredShiftType}`);
      }
      if (prefs.weekendAvailability === "unavailable") parts.push("non disponibile weekend");
      if (prefs.weekendAvailability === "limited") parts.push("disponibilità limitata weekend");
      if (prefs.prefersOpening) parts.push("preferisce apertura");
      if (prefs.prefersClosing) parts.push("preferisce chiusura");
      if (parts.length > 0) prefStr = ` [${parts.join(", ")}]`;
    }
    lines.push(
      `• ${emp.name} (${emp.id.slice(0, 8)}): ${emp.contractHoursPerWeek}h/sett, ` +
      `${emp.daysOffPerWeek} gg riposo, reparto ${emp.department}${prefStr}`,
    );
  }

  if (ctx.coverageRequirements.length > 0) {
    lines.push(`\n--- COPERTURE RICHIESTE ---`);
    const DAY_NAMES = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    for (const req of ctx.coverageRequirements) {
      const max = req.maxStaffRequired != null ? `–${req.maxStaffRequired}` : "";
      lines.push(
        `• ${DAY_NAMES[req.dayOfWeek]} ${req.hourSlot} ${req.department}: ` +
        `min ${req.minStaffRequired}${max} persone`,
      );
    }
  }

  if (ctx.approvedTimeOff.length > 0) {
    lines.push(`\n--- FERIE/PERMESSI APPROVATI ---`);
    const byEmp: Record<string, string[]> = {};
    for (const to of ctx.approvedTimeOff) {
      const emp = ctx.employees.find(e => e.id === to.userId);
      const name = emp?.name ?? to.userId.slice(0, 8);
      if (!byEmp[name]) byEmp[name] = [];
      byEmp[name].push(`${to.date} (${to.type})`);
    }
    for (const [name, entries] of Object.entries(byEmp)) {
      lines.push(`• ${name}: ${entries.join(", ")}`);
    }
  }

  if (ctx.openingHours && ctx.openingHours.length > 0) {
    lines.push(`\n--- ORARI NEGOZIO ---`);
    const DAY_NAMES = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    for (const oh of ctx.openingHours.sort((a, b) => a.dayOfWeek - b.dayOfWeek)) {
      if (oh.isClosed) {
        lines.push(`• ${DAY_NAMES[oh.dayOfWeek]}: CHIUSO`);
      } else {
        lines.push(`• ${DAY_NAMES[oh.dayOfWeek]}: ${oh.openTime}–${oh.closeTime}`);
      }
    }
  }

  if (ctx.previousWeekShifts && ctx.previousWeekShifts.length > 0) {
    lines.push(`\n--- STORICO RECENTE (ultime settimane) ---`);
    const recentByEmp: Record<string, string[]> = {};
    for (const s of ctx.previousWeekShifts) {
      if (!recentByEmp[s.userId]) recentByEmp[s.userId] = [];
      if (!s.isDayOff && s.startTime && s.endTime) {
        recentByEmp[s.userId].push(`${s.date}: ${s.startTime}–${s.endTime}`);
      }
    }
    for (const [uid, entries] of Object.entries(recentByEmp)) {
      const emp = ctx.employees.find(e => e.id === uid);
      const name = emp?.name ?? uid.slice(0, 8);
      // Show max 5 recent shifts per employee to keep prompt concise
      const sample = entries.slice(-5);
      lines.push(`• ${name}: ${sample.join("; ")}`);
    }
  }

  return lines.join("\n");
}
