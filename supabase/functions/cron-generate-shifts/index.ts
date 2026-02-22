import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const publicAppUrl = Deno.env.get("PUBLIC_APP_URL");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Calculate next Monday
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun
    const daysUntilMon = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMon = new Date(now);
    nextMon.setUTCDate(nextMon.getUTCDate() + daysUntilMon);
    const weekStart = nextMon.toISOString().split("T")[0];

    // Get all active stores with generation enabled
    const { data: stores } = await adminClient
      .from("stores")
      .select("id, name")
      .eq("is_active", true);

    if (!stores || stores.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No active stores" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { store: string; department: string; status: string; error?: string }[] = [];

    for (const store of stores) {
      // Check if generation is enabled for this store
      const { data: rules } = await adminClient
        .from("store_rules")
        .select("generation_enabled")
        .eq("store_id", store.id)
        .single();

      if (!rules?.generation_enabled) {
        results.push({ store: store.name, department: "all", status: "skipped", error: "generation_enabled=false" });
        continue;
      }

      // Generate for both departments
      for (const dept of ["sala", "cucina"] as const) {
        try {
          const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-shifts`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              store_id: store.id,
              department: dept,
              week_start: weekStart,
            }),
          });
          const genBody = await genRes.json();
          results.push({
            store: store.name,
            department: dept,
            status: genRes.ok ? "success" : "failed",
            error: genRes.ok ? undefined : genBody.error,
          });
        } catch (e) {
          results.push({ store: store.name, department: dept, status: "failed", error: (e as Error).message });
        }
      }

      // Send notification email to store admins
      if (resendKey && publicAppUrl) {
        // Get admin users for this store
        const { data: assignments } = await adminClient
          .from("user_store_assignments")
          .select("user_id")
          .eq("store_id", store.id);

        const adminUserIds = (assignments ?? []).map(a => a.user_id);

        if (adminUserIds.length > 0) {
          // Get roles and emails
          const { data: roles } = await adminClient
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", adminUserIds);

          const adminIds = (roles ?? [])
            .filter(r => r.role === "admin" || r.role === "super_admin")
            .map(r => r.user_id);

          if (adminIds.length > 0) {
            const { data: profiles } = await adminClient
              .from("profiles")
              .select("id, email, full_name")
              .in("id", adminIds);

            for (const p of profiles ?? []) {
              if (!p.email) continue;
              try {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${resendKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: "Shift Scheduler <onboarding@resend.dev>",
                    to: [p.email],
                    subject: `Draft turni generato – ${store.name}`,
                    html: `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="padding:40px 36px 16px;text-align:center;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Draft turni pronto</h1>
<p style="margin:0;font-size:14px;color:#71717a;">${store.name}</p>
<p style="margin:8px 0 0;font-size:13px;color:#a1a1aa;">Settimana dal ${weekStart}</p>
</td></tr>
<tr><td style="padding:24px 36px;text-align:center;">
<p style="font-size:14px;color:#52525b;">La generazione automatica dei turni è stata completata. Controlla il draft e pubblica quando sei pronto.</p>
</td></tr>
<tr><td style="padding:16px 36px 32px;text-align:center;">
<a href="${publicAppUrl}team-calendar" style="display:inline-block;background:#18181b;color:#fff;font-size:14px;font-weight:600;padding:12px 36px;border-radius:10px;text-decoration:none;">Rivedi turni</a>
</td></tr></table></td></tr></table></body></html>`,
                  }),
                });
              } catch (emailErr) {
                console.error(`Email to ${p.email} failed:`, emailErr);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cron-generate-shifts error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
