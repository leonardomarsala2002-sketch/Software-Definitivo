import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    if (callerRole !== "super_admin" && callerRole !== "admin") {
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

    // Calculate week_end
    const startD = new Date(week_start + "T00:00:00Z");
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const weekEnd = endD.toISOString().split("T")[0];

    // Get ALL generation runs for this week
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

    // Fetch draft shifts for validation before publishing
    const { data: draftShifts, error: draftErr } = await adminClient
      .from("shifts")
      .select("id, user_id, date, start_time, end_time, is_day_off, department, store_id")
      .eq("store_id", store_id)
      .eq("status", "draft")
      .gte("date", week_start)
      .lte("date", weekEnd);

    if (draftErr) throw new Error(draftErr.message);

    // ─── Validation: minimum 4 hours per shift ─────────────────────────
    const MIN_SHIFT_HOURS = 4;
    const invalidShifts: string[] = [];
    for (const s of (draftShifts ?? [])) {
      if (s.is_day_off || !s.start_time || !s.end_time) continue;
      const startH = parseInt(s.start_time.split(":")[0], 10);
      let endH = parseInt(s.end_time.split(":")[0], 10);
      if (endH === 0) endH = 24;
      const duration = endH - startH;
      if (duration < MIN_SHIFT_HOURS) {
        invalidShifts.push(`${s.date} ${s.start_time}-${s.end_time} (${duration}h)`);
      }
    }

    if (invalidShifts.length > 0) {
      return new Response(JSON.stringify({
        error: `Impossibile pubblicare: ${invalidShifts.length} turni sotto le ${MIN_SHIFT_HOURS} ore minime`,
        invalid_shifts: invalidShifts,
      }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Validation: exact coverage (no overbooking) ───────────────────
    const { data: coverageReqs } = await adminClient
      .from("store_coverage_requirements")
      .select("day_of_week, hour_slot, department, min_staff_required")
      .eq("store_id", store_id);

    if (coverageReqs && coverageReqs.length > 0) {
      const overbookedSlots: string[] = [];
      const workShifts = (draftShifts ?? []).filter(s => !s.is_day_off && s.start_time && s.end_time);

      for (const cov of coverageReqs) {
        const covHour = parseInt(cov.hour_slot.split(":")[0], 10);
        // Check each day of the week
        for (const s of workShifts) {
          // We need to check by matching day_of_week
          const d = new Date(s.date + "T00:00:00Z");
          const dow = (d.getUTCDay() + 6) % 7;
          if (dow !== cov.day_of_week || s.department !== cov.department) continue;
        }
        // Count per date
        const datesByDow = new Map<string, number>();
        for (const s of workShifts) {
          const d = new Date(s.date + "T00:00:00Z");
          const dow = (d.getUTCDay() + 6) % 7;
          if (dow !== cov.day_of_week || s.department !== cov.department) continue;
          const startH = parseInt(s.start_time!.split(":")[0], 10);
          let endH = parseInt(s.end_time!.split(":")[0], 10);
          if (endH === 0) endH = 24;
          if (startH <= covHour && endH > covHour) {
            datesByDow.set(s.date, (datesByDow.get(s.date) ?? 0) + 1);
          }
        }
        for (const [date, count] of datesByDow) {
          if (count > cov.min_staff_required) {
            overbookedSlots.push(`${date} ${cov.hour_slot} ${cov.department}: ${count}/${cov.min_staff_required}`);
          }
        }
      }

      if (overbookedSlots.length > 0) {
        return new Response(JSON.stringify({
          error: `Impossibile pubblicare: ${overbookedSlots.length} slot con personale in eccesso`,
          overbooked_slots: overbookedSlots,
        }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update ALL draft shifts for this store+week to published
    const { data: updatedShifts, error: updateErr } = await adminClient
      .from("shifts")
      .update({ status: "published" })
      .eq("store_id", store_id)
      .eq("status", "draft")
      .gte("date", week_start)
      .lte("date", weekEnd)
      .select("user_id, date, start_time, end_time, is_day_off, department");

    if (updateErr) throw new Error(updateErr.message);

    // Update ALL generation runs to published
    for (const run of runs) {
      await adminClient
        .from("generation_runs")
        .update({ status: "published", completed_at: new Date().toISOString() })
        .eq("id", run.id);

      // Commit hour bank from each run
      if (run.hour_adjustments && typeof run.hour_adjustments === "object") {
        for (const [userId, delta] of Object.entries(run.hour_adjustments as Record<string, number>)) {
          if (delta === 0) continue;
          const clampedDelta = Math.max(-5, Math.min(5, delta));
          
          const { data: existing } = await adminClient
            .from("employee_stats")
            .select("id, current_balance")
            .eq("user_id", userId)
            .eq("store_id", store_id)
            .maybeSingle();

          if (existing) {
            await adminClient
              .from("employee_stats")
              .update({ current_balance: Number(existing.current_balance) + clampedDelta, updated_at: new Date().toISOString() })
              .eq("id", existing.id);
          } else {
            await adminClient
              .from("employee_stats")
              .insert({ user_id: userId, store_id, current_balance: clampedDelta });
          }
        }
      }
    }

    // Send email notifications
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
        const profile = profiles?.find(p => p.id === userId);
        if (!profile?.email) continue;

        const workShifts = userShifts.filter(s => !s.is_day_off).sort((a, b) => a.date.localeCompare(b.date));
        const shiftLines = workShifts.map(s => {
          const d = new Date(s.date + "T00:00:00Z");
          const dayName = d.toLocaleDateString("it-IT", { weekday: "long", timeZone: "UTC" });
          const dateStr = d.toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
          return `<tr><td style="padding:8px 16px;font-size:14px;color:#18181b;">${dayName} ${dateStr}</td><td style="padding:8px 16px;font-size:14px;font-weight:600;color:#18181b;text-align:right;">${s.start_time?.slice(0, 5)} – ${s.end_time?.slice(0, 5)}</td><td style="padding:8px 8px;font-size:12px;color:#71717a;">${s.department === "sala" ? "Sala" : "Cucina"}</td></tr>`;
        }).join("");

        const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="padding:40px 36px 16px;text-align:center;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Turni pubblicati</h1>
<p style="margin:0;font-size:14px;color:#71717a;">${store?.name ?? "Store"}</p>
<p style="margin:4px 0 0;font-size:13px;color:#a1a1aa;">Settimana ${week_start} → ${weekEnd}</p>
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
              subject: `Turni pubblicati – ${store?.name ?? "Store"}`,
              html,
            }),
          });
        } catch (emailErr) {
          console.error(`Failed to email ${profile.email}:`, emailErr);
        }

        // In-app notification
        try {
          await adminClient.from("notifications").insert({
            user_id: userId,
            store_id: store_id,
            type: "shifts_published",
            title: "Turni pubblicati",
            message: `I tuoi turni per la settimana del ${week_start} su ${store?.name ?? "Store"} sono stati pubblicati.`,
            link: "/team-calendar",
          });
        } catch (notifErr) {
          console.error(`Notification insert failed for ${userId}:`, notifErr);
        }
      }
    }

    // Audit log
    const { data: callerProfile } = await adminClient.from("profiles").select("full_name").eq("id", userData.user.id).single();
    await adminClient.from("audit_logs").insert({
      user_id: userData.user.id,
      user_name: callerProfile?.full_name ?? userData.user.email,
      action: "publish",
      entity_type: "shifts",
      store_id: store_id,
      details: {
        description: `Pubblicati ${updatedShifts?.length ?? 0} turni per settimana ${week_start}`,
        week_start,
        week_end: weekEnd,
        shifts_count: updatedShifts?.length ?? 0,
      },
    });

    return new Response(JSON.stringify({ ok: true, published: updatedShifts?.length ?? 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("publish-shifts error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
