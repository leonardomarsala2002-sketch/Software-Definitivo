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

    const { generation_run_id } = await req.json();
    if (!generation_run_id) {
      return new Response(JSON.stringify({ error: "generation_run_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the run
    const { data: run } = await adminClient
      .from("generation_runs")
      .select("*")
      .eq("id", generation_run_id)
      .single();

    if (!run) {
      return new Response(JSON.stringify({ error: "Run not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update all draft shifts for this run to published
    const { data: updatedShifts, error: updateErr } = await adminClient
      .from("shifts")
      .update({ status: "published" })
      .eq("generation_run_id", generation_run_id)
      .eq("status", "draft")
      .select("user_id, date, start_time, end_time, is_day_off, department");

    if (updateErr) throw new Error(updateErr.message);

    // Update run status
    await adminClient
      .from("generation_runs")
      .update({ status: "published", completed_at: new Date().toISOString() })
      .eq("id", generation_run_id);

    // Send email notifications to employees
    if (resendKey && publicAppUrl && updatedShifts && updatedShifts.length > 0) {
      // Group shifts by user
      const shiftsByUser = new Map<string, typeof updatedShifts>();
      for (const s of updatedShifts) {
        const arr = shiftsByUser.get(s.user_id) ?? [];
        arr.push(s);
        shiftsByUser.set(s.user_id, arr);
      }

      // Get employee profiles
      const userIds = [...shiftsByUser.keys()];
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const { data: store } = await adminClient
        .from("stores")
        .select("name")
        .eq("id", run.store_id)
        .single();

      for (const [userId, userShifts] of shiftsByUser) {
        const profile = profiles?.find(p => p.id === userId);
        if (!profile?.email) continue;

        const workShifts = userShifts
          .filter(s => !s.is_day_off)
          .sort((a, b) => a.date.localeCompare(b.date));

        const shiftLines = workShifts.map(s => {
          const d = new Date(s.date + "T00:00:00Z");
          const dayName = d.toLocaleDateString("it-IT", { weekday: "long", timeZone: "UTC" });
          const dateStr = d.toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
          return `<tr><td style="padding:8px 16px;font-size:14px;color:#18181b;">${dayName} ${dateStr}</td><td style="padding:8px 16px;font-size:14px;font-weight:600;color:#18181b;text-align:right;">${s.start_time?.slice(0, 5)} – ${s.end_time?.slice(0, 5)}</td></tr>`;
        }).join("");

        const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="padding:40px 36px 16px;text-align:center;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Turni pubblicati</h1>
<p style="margin:0;font-size:14px;color:#71717a;">${store?.name ?? "Store"} · ${run.department === "sala" ? "Sala" : "Cucina"}</p>
<p style="margin:4px 0 0;font-size:13px;color:#a1a1aa;">Settimana ${run.week_start} → ${run.week_end}</p>
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
      }
    }

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
