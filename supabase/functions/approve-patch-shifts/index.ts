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

    // Auth
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
    const { store_id, week_start, generation_run_ids } = body;

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

    // Find draft shifts for this store+week (from patch regeneration)
    const { data: draftShifts, error: fetchErr } = await adminClient
      .from("shifts")
      .select("id, user_id, date, start_time, end_time, is_day_off, department")
      .eq("store_id", store_id)
      .eq("status", "draft")
      .gte("date", week_start)
      .lte("date", weekEnd);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!draftShifts || draftShifts.length === 0) {
      return new Response(JSON.stringify({ error: "No draft shifts to approve" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Publish all draft shifts
    const { error: updateErr } = await adminClient
      .from("shifts")
      .update({ status: "published" })
      .eq("store_id", store_id)
      .eq("status", "draft")
      .gte("date", week_start)
      .lte("date", weekEnd);

    if (updateErr) throw new Error(updateErr.message);

    // Update generation runs if provided
    if (generation_run_ids && generation_run_ids.length > 0) {
      for (const runId of generation_run_ids) {
        await adminClient.from("generation_runs")
          .update({ status: "published", completed_at: new Date().toISOString() })
          .eq("id", runId);
      }
    }

    // Audit log
    const { data: callerProfile } = await adminClient
      .from("profiles").select("full_name").eq("id", userData.user.id).single();
    await adminClient.from("audit_logs").insert({
      user_id: userData.user.id,
      user_name: callerProfile?.full_name ?? userData.user.email,
      action: "publish",
      entity_type: "shifts",
      store_id,
      details: {
        description: `Approvata proposta di copertura: ${draftShifts.length} turni pubblicati (settimana ${week_start})`,
        week_start,
        week_end: weekEnd,
        shifts_count: draftShifts.length,
        is_patch_approval: true,
      },
    });

    // Send email notifications ONLY to employees whose shifts changed
    if (resendKey && publicAppUrl) {
      const affectedUserIds = [...new Set(draftShifts.map(s => s.user_id))];
      const { data: profiles } = await adminClient
        .from("profiles").select("id, full_name, email").in("id", affectedUserIds);
      const { data: store } = await adminClient
        .from("stores").select("name").eq("id", store_id).single();

      for (const profile of (profiles ?? [])) {
        if (!profile.email) continue;
        const userShifts = draftShifts
          .filter(s => s.user_id === profile.id && !s.is_day_off)
          .sort((a, b) => a.date.localeCompare(b.date));

        const shiftLines = userShifts.map(s => {
          const d = new Date(s.date + "T00:00:00Z");
          const dayName = d.toLocaleDateString("it-IT", { weekday: "long", timeZone: "UTC" });
          const dateStr = d.toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
          return `<tr><td style="padding:8px 16px;font-size:14px;color:#18181b;">${dayName} ${dateStr}</td><td style="padding:8px 16px;font-size:14px;font-weight:600;color:#18181b;text-align:right;">${s.start_time?.slice(0, 5)} – ${s.end_time?.slice(0, 5)}</td><td style="padding:8px 8px;font-size:12px;color:#71717a;">${s.department === "sala" ? "Sala" : "Cucina"}</td></tr>`;
        }).join("");

        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Shift Scheduler <onboarding@resend.dev>",
              to: [profile.email],
              subject: `📋 Aggiornamento turni – ${store?.name ?? "Store"}`,
              html: `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="padding:40px 36px 16px;text-align:center;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">📋 Aggiornamento Turni</h1>
<p style="margin:0;font-size:14px;color:#71717a;">${store?.name ?? "Store"}</p>
<p style="margin:4px 0 0;font-size:13px;color:#a1a1aa;">I tuoi turni sono stati aggiornati</p>
</td></tr>
<tr><td style="padding:16px 36px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:12px;">${shiftLines}</table>
</td></tr>
<tr><td style="padding:24px 36px;text-align:center;">
<a href="${publicAppUrl}/personal-calendar" style="display:inline-block;background:#18181b;color:#fff;font-size:14px;font-weight:600;padding:12px 36px;border-radius:10px;text-decoration:none;">Vedi calendario</a>
</td></tr></table></td></tr></table></body></html>`,
            }),
          });
        } catch (emailErr) {
          console.error(`Failed to email ${profile.email}:`, emailErr);
        }

        // In-app notification
        try {
          await adminClient.from("notifications").insert({
            user_id: profile.id,
            store_id: store_id,
            type: "shift_updated",
            title: "Turno aggiornato",
            message: `Il tuo turno su ${store?.name ?? "Store"} è stato modificato per coprire un'assenza. Controlla il calendario.`,
            link: "/team-calendar",
          });
        } catch (notifErr) {
          console.error(`Notification insert failed for ${profile.id}:`, notifErr);
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      published: draftShifts.length,
      affected_users: [...new Set(draftShifts.map(s => s.user_id))].length,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("approve-patch-shifts error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
