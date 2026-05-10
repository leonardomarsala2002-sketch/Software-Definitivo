import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkRateLimit } from "../_shared/auth.ts";
import { validateSchedule } from "../_shared/scheduling-engine/validator.ts";
import type { ScheduleContext, ShiftInput, TimeOffType, EmployeeInfo, CoverageRequirement, ApprovedTimeOff } from "../_shared/scheduling-engine/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const publicAppUrl = Deno.env.get("PUBLIC_APP_URL");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await anonClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: userData.user.id });
    if (callerRole !== "super_admin" && callerRole !== "admin" && callerRole !== "store_manager") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { store_id, week_start } = body;

    if (!store_id || !week_start) {
      return new Response(JSON.stringify({ error: "store_id and week_start required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 5 publish operations per user per store per 5 minutes
    const rlResp = await checkRateLimit(adminClient, `publish-shifts:${userData.user.id}:${store_id}`, 5, 300);
    if (rlResp) return rlResp;

    // Calculate week_end
    const startD = new Date(week_start + "T00:00:00Z");
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const weekEnd = endD.toISOString().split("T")[0];

    // Get ALL completed generation runs for this week
    const { data: runs } = await adminClient
      .from("generation_runs")
      .select("id, department, hour_adjustments")
      .eq("store_id", store_id)
      .eq("week_start", week_start)
      .in("status", ["completed"]);

    if (!runs || runs.length === 0) {
      return new Response(JSON.stringify({ error: "No completed generation runs found for this week" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch draft shifts
    const { data: draftShifts, error: draftErr } = await adminClient
      .from("shifts")
      .select("id, user_id, date, start_time, end_time, is_day_off, department, store_id")
      .eq("store_id", store_id)
      .eq("status", "draft")
      .gte("date", week_start)
      .lte("date", weekEnd);

    if (draftErr) throw new Error(draftErr.message);

    // ─── Build ScheduleContext for the rule engine ────────────────────────────

    const [empDetailsRes, coverageReqsRes, timeOffRes, storeRulesRes, empStatsRes] = await Promise.all([
      adminClient
        .from("employee_details")
        .select("user_id, weekly_contract_hours, department")
        .eq("store_id", store_id)
        .eq("is_active", true),
      adminClient
        .from("store_coverage_requirements")
        .select("day_of_week, hour_slot, department, min_staff_required, max_staff_required")
        .eq("store_id", store_id),
      adminClient
        .from("time_off_requests")
        .select("user_id, request_type, request_date")
        .eq("store_id", store_id)
        .eq("status", "approved")
        .gte("request_date", week_start)
        .lte("request_date", weekEnd),
      adminClient
        .from("store_rules")
        .select("mandatory_days_off_per_week, min_daily_hours_per_employee, max_weekly_hours_per_employee")
        .eq("store_id", store_id)
        .maybeSingle(),
      adminClient
        .from("employee_stats")
        .select("user_id, current_balance")
        .eq("store_id", store_id),
    ]);

    const empIds = (empDetailsRes.data ?? []).map((e: { user_id: string }) => e.user_id);
    const { data: empProfiles } = empIds.length > 0
      ? await adminClient.from("profiles").select("id, full_name").in("id", empIds)
      : { data: [] };

    const profileMap = new Map((empProfiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
    const statMap = new Map(
      (empStatsRes.data ?? []).map((s: { user_id: string; current_balance: number }) => [s.user_id, s.current_balance]),
    );
    const storeRules = storeRulesRes.data;

    const employees: EmployeeInfo[] = (empDetailsRes.data ?? []).map(
      (e: { user_id: string; weekly_contract_hours: number | null; department: string | null }) => ({
        id: e.user_id,
        name: profileMap.get(e.user_id) ?? e.user_id,
        department: e.department ?? "sala",
        contractHoursPerWeek: e.weekly_contract_hours ?? 40,
        daysOffPerWeek: storeRules?.mandatory_days_off_per_week ?? 1,
        hourBankBalance: statMap.get(e.user_id) ?? 0,
      }),
    );

    const coverageRequirements: CoverageRequirement[] = (coverageReqsRes.data ?? []).map(
      (r: { day_of_week: number; hour_slot: string; department: string; min_staff_required: number; max_staff_required: number | null }) => ({
        dayOfWeek: r.day_of_week,
        hourSlot: r.hour_slot,
        department: r.department,
        minStaffRequired: r.min_staff_required,
        maxStaffRequired: r.max_staff_required ?? undefined,
      }),
    );

    const approvedTimeOff: ApprovedTimeOff[] = (timeOffRes.data ?? []).map(
      (t: { user_id: string; request_type: string; request_date: string }) => ({
        userId: t.user_id,
        type: t.request_type as TimeOffType,
        date: t.request_date,
      }),
    );

    const scheduleContext: ScheduleContext = {
      storeId: store_id,
      weekStart: week_start,
      weekEnd,
      employees,
      coverageRequirements,
      approvedTimeOff,
      storeRules: {
        minShiftHours: storeRules?.min_daily_hours_per_employee ?? 3,
        maxShiftHours: 10,
        mandatoryDaysOffPerWeek: storeRules?.mandatory_days_off_per_week ?? 1,
        contractHoursToleranceH: 5,
        holidayCoverageMultiplier: 1.2,
      },
    };

    const shiftsForValidation: ShiftInput[] = (draftShifts ?? []).map(
      (s: { id: string; user_id: string; date: string; start_time: string | null; end_time: string | null; is_day_off: boolean; department: string | null }) => ({
        id: s.id,
        userId: s.user_id,
        storeId: store_id,
        date: s.date,
        startTime: s.start_time,
        endTime: s.end_time,
        isDayOff: s.is_day_off ?? false,
        department: s.department ?? "sala",
      }),
    );

    // ─── Run the rule engine validation ───────────────────────────────────────

    const validation = validateSchedule(shiftsForValidation, scheduleContext);

    if (!validation.isValid) {
      return new Response(JSON.stringify({
        error: `Impossibile pubblicare: ${validation.hardViolations.length} violazioni gravi`,
        hard_violations: validation.hardViolations,
        soft_warnings: validation.softWarnings,
        quality_score: validation.qualityScore,
        metrics: validation.metrics,
      }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Publish all draft shifts ─────────────────────────────────────────────

    const { data: updatedShifts, error: updateErr } = await adminClient
      .from("shifts")
      .update({ status: "published" })
      .eq("store_id", store_id)
      .eq("status", "draft")
      .gte("date", week_start)
      .lte("date", weekEnd)
      .select("user_id, date, start_time, end_time, is_day_off, department");

    if (updateErr) throw new Error(updateErr.message);

    // ─── Update generation runs + commit hour bank ─────────────────────────────
    // Note: shifts are already published at this point. Failures here are logged
    // but do not roll back the publish — the schedule remains visible to employees.

    const runUpdateWarnings: string[] = [];

    for (const run of runs) {
      const { error: runErr } = await adminClient
        .from("generation_runs")
        .update({
          status: "published",
          lifecycle_status: "published",
          completed_at: new Date().toISOString(),
          quality_score: validation.qualityScore,
          validation_result: JSON.stringify(validation),
        })
        .eq("id", run.id);

      if (runErr) {
        const msg = `generation_run ${run.id}: ${runErr.message}`;
        runUpdateWarnings.push(msg);
        console.error("[publish-shifts] run update failed:", msg);
      }

      if (run.hour_adjustments && typeof run.hour_adjustments === "object") {
        for (const [userId, delta] of Object.entries(run.hour_adjustments as Record<string, number>)) {
          if (delta === 0) continue;

          const { data: existing } = await adminClient
            .from("employee_stats")
            .select("id, current_balance")
            .eq("user_id", userId)
            .eq("store_id", store_id)
            .maybeSingle();

          const { error: statErr } = existing
            ? await adminClient
                .from("employee_stats")
                .update({ current_balance: Number(existing.current_balance) + delta, updated_at: new Date().toISOString() })
                .eq("id", existing.id)
            : await adminClient
                .from("employee_stats")
                .insert({ user_id: userId, store_id, current_balance: delta });

          if (statErr) {
            const msg = `employee_stats ${userId}: ${statErr.message}`;
            runUpdateWarnings.push(msg);
            console.error("[publish-shifts] stats update failed:", msg);
          }
        }
      }
    }

    // ─── Save schedule version snapshot ──────────────────────────────────────

    try {
      await adminClient.rpc("create_schedule_version", {
        p_store_id: store_id,
        p_week_start: week_start,
        p_lifecycle_status: "published",
        p_shifts_snapshot: JSON.stringify(shiftsForValidation),
        p_quality_score: validation.qualityScore,
        p_validation_result: JSON.stringify(validation),
        p_hard_violations: validation.hardViolations.length,
        p_soft_warnings: validation.softWarnings.length,
        p_generation_run_id: runs[0]?.id ?? null,
        p_created_by: userData.user.id,
        p_note: `Pubblicazione manuale — score ${validation.qualityScore}/100`,
      });
    } catch (versionErr) {
      console.error("schedule_version insert failed (non-blocking):", versionErr);
    }

    // ─── Email notifications ──────────────────────────────────────────────────

    if (resendKey && publicAppUrl && updatedShifts && updatedShifts.length > 0) {
      const shiftsByUser = new Map<string, typeof updatedShifts>();
      for (const s of updatedShifts) {
        const arr = shiftsByUser.get(s.user_id) ?? [];
        arr.push(s);
        shiftsByUser.set(s.user_id, arr);
      }

      const userIds = [...shiftsByUser.keys()];
      const { data: profiles } = await adminClient.from("profiles").select("id, full_name, email").in("id", userIds);
      const { data: store } = await adminClient.from("stores").select("name").eq("id", store_id).single();

      for (const [userId, userShifts] of shiftsByUser) {
        const profile = profiles?.find((p: { id: string }) => p.id === userId) as { id: string; full_name: string; email: string } | undefined;
        if (!profile?.email) continue;

        const workShifts = userShifts.filter(s => !s.is_day_off).sort((a, b) => a.date.localeCompare(b.date));
        const shiftLines = workShifts.map(s => {
          const d = new Date(s.date + "T00:00:00Z");
          const dayName = d.toLocaleDateString("it-IT", { weekday: "long", timeZone: "UTC" });
          const dateStr = d.toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
          return `<tr><td style="padding:8px 16px;font-size:14px;color:#18181b;">${dayName} ${dateStr}</td><td style="padding:8px 16px;font-size:14px;font-weight:600;color:#18181b;text-align:right;">${s.start_time?.slice(0, 5)} – ${s.end_time?.slice(0, 5)}</td><td style="padding:8px 8px;font-size:12px;color:#71717a;">${s.department === "sala" ? "Sala" : "Cucina"}</td></tr>`;
        }).join("");

        const scoreNote = validation.softWarnings.length > 0
          ? `<p style="margin:0 0 4px;font-size:12px;color:#a1a1aa;">Qualità pianificazione: ${validation.qualityScore}/100${validation.softWarnings.length > 0 ? ` (${validation.softWarnings.length} avvisi)` : ""}</p>`
          : "";

        const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="padding:40px 36px 16px;text-align:center;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Turni pubblicati</h1>
<p style="margin:0;font-size:14px;color:#71717a;">${(store as { name: string } | null)?.name ?? "Store"}</p>
<p style="margin:4px 0 0;font-size:13px;color:#a1a1aa;">Settimana ${week_start} → ${weekEnd}</p>
${scoreNote}
</td></tr>
<tr><td style="padding:16px 36px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:12px;">${shiftLines}</table>
</td></tr>
<tr><td style="padding:24px 36px;text-align:center;">
<a href="${publicAppUrl}" style="display:inline-block;background:#18181b;color:#fff;font-size:14px;font-weight:600;padding:12px 36px;border-radius:10px;text-decoration:none;">Apri calendario</a>
</td></tr></table></td></tr></table></body></html>`;

        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Shift Scheduler <onboarding@resend.dev>",
              to: [profile.email],
              subject: `Turni pubblicati – ${(store as { name: string } | null)?.name ?? "Store"}`,
              html,
            }),
          });
        } catch (emailErr) {
          console.error(`Failed to email ${profile.email}:`, emailErr);
        }

        try {
          await adminClient.from("notifications").insert({
            user_id:  userId,
            store_id: store_id,
            type:     "shifts_published",
            title:    "Turni pubblicati",
            message:  `I tuoi turni per la settimana del ${week_start} su ${(store as { name: string } | null)?.name ?? "Store"} sono stati pubblicati.`,
            link:     "/personal-calendar",
            channel:  "in-app",
            sent_at:  new Date().toISOString(),
          });
        } catch (notifErr) {
          console.error(`Notification insert failed for ${userId}:`, notifErr);
        }
      }
    }

    // ─── Audit log ────────────────────────────────────────────────────────────

    const { data: callerProfile } = await adminClient.from("profiles").select("full_name").eq("id", userData.user.id).single();
    await adminClient.from("audit_logs").insert({
      user_id: userData.user.id,
      user_name: (callerProfile as { full_name: string } | null)?.full_name ?? userData.user.email,
      action: "publish",
      entity_type: "shifts",
      store_id: store_id,
      details: {
        description: `Pubblicati ${updatedShifts?.length ?? 0} turni per settimana ${week_start}`,
        week_start,
        week_end: weekEnd,
        shifts_count: updatedShifts?.length ?? 0,
        quality_score: validation.qualityScore,
        soft_warnings_count: validation.softWarnings.length,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      published: updatedShifts?.length ?? 0,
      quality_score: validation.qualityScore,
      soft_warnings: validation.softWarnings.length,
      metrics: validation.metrics,
      ...(runUpdateWarnings.length > 0 && { internal_warnings: runUpdateWarnings }),
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("publish-shifts error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
