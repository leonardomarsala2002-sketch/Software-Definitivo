import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAuth, hasStoreAccess, checkRateLimit, writeAuditLog } from "../_shared/auth.ts";
import { buildAIContext } from "../_shared/ai-assistant/context-builder.ts";
import { processAIOutput, describeHardViolations } from "../_shared/ai-assistant/bridge.ts";
import { createProvider } from "../_shared/ai-assistant/providers/index.ts";
import { proposeSchedule } from "../_shared/ai-assistant/features/propose-schedule.ts";
import { suggestModifications } from "../_shared/ai-assistant/features/suggest-modifications.ts";
import { explainAssignment } from "../_shared/ai-assistant/features/explain-assignment.ts";
import { suggestAlternatives } from "../_shared/ai-assistant/features/suggest-alternatives.ts";
import { partialRegen } from "../_shared/ai-assistant/features/partial-regen.ts";
import { qualityReport } from "../_shared/ai-assistant/features/quality-report.ts";
import { highlightCriticalities } from "../_shared/ai-assistant/features/highlight-criticalities.ts";
import type {
  AIRawData,
  AIRawEmployee,
  EmployeeAIPreferences,
} from "../_shared/ai-assistant/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ─── DB helpers ───────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

async function buildRawData(
  adminClient: ReturnType<typeof createClient>,
  storeId: string,
  weekStart: string,
): Promise<AIRawData> {
  const weekEnd = addDays(weekStart, 6);
  const fourWeeksAgo = addDays(weekStart, -28);

  const [
    assignmentsRes,
    empDetailsRes,
    prefsRes,
    timeOffRes,
    coverageRes,
    rulesRes,
    openingRes,
    recentShiftsRes,
    storeRes,
  ] = await Promise.all([
    adminClient
      .from("user_store_assignments")
      .select("user_id")
      .eq("store_id", storeId),

    adminClient
      .from("employee_details")
      .select("user_id, first_name, last_name, department, weekly_contract_hours, is_active"),

    adminClient
      .from("employee_preferences")
      .select("user_id, preferred_shift_type, preferred_days_off, weekend_availability, prefers_opening, prefers_closing, hour_distribution"),

    adminClient
      .from("time_off_requests")
      .select("user_id, request_date, request_type")
      .eq("store_id", storeId)
      .eq("status", "approved")
      .gte("request_date", weekStart)
      .lte("request_date", weekEnd),

    adminClient
      .from("store_coverage_requirements")
      .select("day_of_week, hour_slot, department, min_staff_required, max_staff_required")
      .eq("store_id", storeId),

    adminClient
      .from("store_rules")
      .select("min_daily_hours_per_employee, max_daily_hours_per_employee, mandatory_days_off_per_week")
      .eq("store_id", storeId)
      .single(),

    adminClient
      .from("store_opening_hours")
      .select("day_of_week, opening_time, closing_time")
      .eq("store_id", storeId),

    adminClient
      .from("shifts")
      .select("user_id, date, start_time, end_time, is_day_off, department")
      .eq("store_id", storeId)
      .eq("status", "published")
      .gte("date", fourWeeksAgo)
      .lt("date", weekStart)
      .order("date", { ascending: false }),

    adminClient
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .single(),
  ]);

  // Filter employees to those assigned to this store
  const storeUserIds = new Set((assignmentsRes.data ?? []).map((a: any) => a.user_id));
  const empDetails: any[] = (empDetailsRes.data ?? []).filter((e: any) => storeUserIds.has(e.user_id) && e.is_active);

  // Build preferences map
  const prefsMap = new Map<string, any>();
  for (const p of (prefsRes.data ?? [])) {
    prefsMap.set(p.user_id, p);
  }

  const employees: AIRawEmployee[] = empDetails.map((e: any) => {
    const prefs = prefsMap.get(e.user_id);
    const preferences: EmployeeAIPreferences | undefined = prefs
      ? {
          preferredShiftType: prefs.preferred_shift_type ?? null,
          preferredDaysOff: prefs.preferred_days_off ?? [],
          weekendAvailability: prefs.weekend_availability ?? "available",
          prefersOpening: prefs.prefers_opening ?? false,
          prefersClosing: prefs.prefers_closing ?? false,
          hourDistribution: prefs.hour_distribution ?? null,
        }
      : undefined;

    return {
      id: e.user_id,
      name: [e.first_name, e.last_name].filter(Boolean).join(" ") || e.user_id.slice(0, 8),
      department: e.department,
      weeklyContractHours: e.weekly_contract_hours ?? 40,
      daysOffPerWeek: rulesRes.data?.mandatory_days_off_per_week ?? 2,
      preferences,
    };
  });

  const approvedTimeOff = (timeOffRes.data ?? []).map((r: any) => ({
    userId: r.user_id,
    type: r.request_type as any,
    date: r.request_date,
  }));

  const coverageRequirements = (coverageRes.data ?? []).map((c: any) => ({
    dayOfWeek: c.day_of_week,
    hourSlot: c.hour_slot,
    department: c.department,
    minStaffRequired: c.min_staff_required,
    maxStaffRequired: c.max_staff_required ?? undefined,
  }));

  const storeRules = {
    minShiftHours: rulesRes.data?.min_daily_hours_per_employee ?? 3,
    maxShiftHours: rulesRes.data?.max_daily_hours_per_employee ?? 10,
    contractHoursToleranceH: 5,
  };

  const openingHours = (openingRes.data ?? []).map((o: any) => ({
    dayOfWeek: o.day_of_week,
    openTime: o.opening_time,
    closeTime: o.closing_time,
    isClosed: false,
  }));

  const recentShifts = (recentShiftsRes.data ?? []).map((s: any) => ({
    userId: s.user_id,
    storeId,
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    isDayOff: s.is_day_off,
    department: s.department,
  }));

  return {
    storeId,
    storeName: (storeRes.data as any)?.name ?? undefined,
    weekStart,
    weekEnd,
    employees,
    approvedTimeOff,
    coverageRequirements,
    storeRules,
    openingHours,
    recentShifts,
    holidays: [],
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth (managers only)
  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;
  const { userId, role, adminClient } = authResult;

  // Rate limit: 5 AI calls per minute per user
  const rateLimitKey = `ai-assistant:${userId}`;
  const rateLimitResp = await checkRateLimit(adminClient, rateLimitKey, 5, 60);
  if (rateLimitResp) return rateLimitResp;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const action = body.action as string;
  const storeId = body.store_id as string;
  const weekStart = body.week_start as string;
  const params = (body.params ?? {}) as Record<string, unknown>;

  if (!action || !storeId || !weekStart) {
    return json({ error: "action, store_id e week_start sono richiesti" }, 400);
  }

  // Store access check
  const hasAccess = await hasStoreAccess(adminClient, userId, storeId, role);
  if (!hasAccess) return json({ error: "Accesso al negozio non autorizzato" }, 403);

  // Load provider from env vars (never hardcoded)
  let provider;
  try {
    provider = createProvider({
      provider: Deno.env.get("AI_PROVIDER") ?? "anthropic",
      anthropicApiKey: Deno.env.get("ANTHROPIC_API_KEY"),
      openaiApiKey: Deno.env.get("OPENAI_API_KEY"),
      model: Deno.env.get("AI_MODEL"),
    });
  } catch (err: any) {
    console.error("[ai-assistant] Provider init failed:", err.message);
    return json({ error: "AI provider non configurato. Contatta l'amministratore." }, 503);
  }

  // Fetch context from DB
  let rawData: AIRawData;
  try {
    rawData = await buildRawData(adminClient, storeId, weekStart);
  } catch (err: any) {
    console.error("[ai-assistant] buildRawData error:", err);
    return json({ error: "Errore nel caricamento dei dati del negozio" }, 500);
  }

  if (rawData.employees.length === 0) {
    return json({ error: "Nessun dipendente attivo trovato per questo negozio" }, 422);
  }

  const context = buildAIContext(rawData);

  try {
    // ─── Features that return text/structured reports ─────────────────────
    if (action === "quality_report") {
      const existingShifts = (params.existing_shifts ?? []) as any[];
      const result = await qualityReport(provider, context, { existingShifts });
      await writeAuditLog(adminClient, {
        userId, role, storeId, action: "ai_quality_report",
        entityType: "schedule", details: { weekStart, qualityScore: result.structuredData?.qualityScore }, req,
      });
      return json({ feature: action, result });
    }

    if (action === "highlight_criticalities") {
      const existingShifts = (params.existing_shifts ?? []) as any[];
      const result = await highlightCriticalities(provider, context, { existingShifts });
      await writeAuditLog(adminClient, {
        userId, role, storeId, action: "ai_highlight_criticalities",
        entityType: "schedule", details: { weekStart, issueCount: result.uncoveredSlots.length + result.overloadedEmployees.length }, req,
      });
      return json({ feature: action, result });
    }

    if (action === "explain_assignment") {
      const existingShifts = (params.existing_shifts ?? []) as any[];
      const employeeId = params.employee_id as string;
      const date = params.date as string;
      if (!employeeId || !date) {
        return json({ error: "employee_id e date sono richiesti per explain_assignment" }, 400);
      }
      const result = await explainAssignment(provider, context, { existingShifts, employeeId, date });
      return json({ feature: action, result });
    }

    // ─── Features that propose shifts (must pass through bridge) ─────────
    let aiProposal;

    if (action === "propose_schedule") {
      aiProposal = await proposeSchedule(provider, context, { notes: params.notes as string });

    } else if (action === "suggest_modifications") {
      const existingShifts = (params.existing_shifts ?? []) as any[];
      const focusIds = params.focus_employee_ids as string[] | undefined;
      aiProposal = await suggestModifications(provider, context, {
        existingShifts,
        focusEmployeeIds: focusIds,
        notes: params.notes as string,
      });

    } else if (action === "suggest_alternatives") {
      const existingShifts = (params.existing_shifts ?? []) as any[];
      const conflictDescription = params.conflict_description as string;
      if (!conflictDescription) {
        return json({ error: "conflict_description è richiesto per suggest_alternatives" }, 400);
      }
      aiProposal = await suggestAlternatives(provider, context, {
        existingShifts,
        conflictDescription,
        affectedEmployeeId: params.affected_employee_id as string,
        affectedDate: params.affected_date as string,
      });

    } else if (action === "partial_regen") {
      const lockedShifts = (params.locked_shifts ?? []) as any[];
      const fromDate = params.from_date as string;
      if (!fromDate) {
        return json({ error: "from_date è richiesto per partial_regen" }, 400);
      }
      aiProposal = await partialRegen(provider, context, {
        lockedShifts,
        fromDate,
        notes: params.notes as string,
      });

    } else {
      return json({ error: `Azione non riconosciuta: ${action}` }, 400);
    }

    // ─── Bridge: validate AI proposal through rule engine ────────────────
    const processed = processAIOutput(aiProposal, context);

    if (!processed.isValid) {
      // Hard violations that could not be auto-corrected — inform the caller
      return json(
        {
          error: "La proposta AI contiene violazioni non correggibili automaticamente",
          hardViolations: processed.hardViolations,
          violationsSummary: describeHardViolations(processed.hardViolations),
          autoCorrectionsApplied: processed.autoCorrectionsApplied,
        },
        422,
      );
    }

    await writeAuditLog(adminClient, {
      userId, role, storeId, action: `ai_${action}`,
      entityType: "schedule",
      details: {
        weekStart,
        qualityScore: processed.qualityScore,
        autoCorrections: processed.autoCorrectionsApplied.length,
        resolvedViolations: processed.resolvedViolations.length,
      },
      req,
    });

    return json({
      feature: action,
      proposal: {
        shifts: processed.shifts,
        explanations: processed.explanations,
        generalReasoning: processed.generalReasoning,
        qualityScore: processed.qualityScore,
        metrics: processed.metrics,
        softWarnings: processed.softWarnings,
        autoCorrectionsApplied: processed.autoCorrectionsApplied,
        resolvedViolations: processed.resolvedViolations,
        aiWarnings: processed.aiWarnings,
      },
    });

  } catch (err: any) {
    console.error(`[ai-assistant] ${action} error:`, err);

    // Surface AI provider rate limit or auth errors clearly
    const msg = err.message ?? "Errore interno";
    if (msg.includes("429")) {
      return json({ error: "AI provider ha raggiunto il limite di richieste. Riprova tra un momento." }, 429);
    }
    if (msg.includes("401") || msg.includes("API key")) {
      return json({ error: "Chiave API AI non valida o non configurata." }, 503);
    }

    return json({ error: `Errore nell'elaborazione AI: ${msg}` }, 500);
  }
});
