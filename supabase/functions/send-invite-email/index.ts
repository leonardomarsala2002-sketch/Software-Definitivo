import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  employee: "Dipendente",
};

const deptLabels: Record<string, string> = {
  sala: "Sala",
  cucina: "Cucina",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const publicAppUrl = Deno.env.get("PUBLIC_APP_URL");

    if (!resendKey) {
      throw new Error("RESEND_API_KEY not configured");
    }
    if (!publicAppUrl) {
      throw new Error("PUBLIC_APP_URL not configured");
    }

    // Verify caller
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { invitation_id } = await req.json();
    if (!invitation_id) {
      return new Response(JSON.stringify({ error: "invitation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch invitation
    const { data: inv, error: invErr } = await adminClient
      .from("invitations")
      .select("id, email, token, role, department, store_id, expires_at, invited_by, stores(name)")
      .eq("id", invitation_id)
      .single();

    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is the inviter or has permission (admin/super_admin of that store)
    const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: userId });
    if (callerRole !== "super_admin") {
      if (callerRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Check store membership
      if (inv.store_id) {
        const { data: isMember } = await adminClient.rpc("is_store_member", {
          _user_id: userId,
          _store_id: inv.store_id,
        });
        if (!isMember) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const inviteUrl = `${publicAppUrl}invite?token=${inv.token}`;
    const storeName = (inv as any).stores?.name ?? "—";
    const roleName = roleLabels[inv.role] ?? inv.role;
    const deptName = inv.department ? (deptLabels[inv.department] ?? inv.department) : "—";
    const expiresDate = new Date(inv.expires_at).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const htmlBody = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <tr><td style="padding:40px 36px 24px;text-align:center;">
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;">Sei stato invitato!</h1>
    <p style="margin:0;font-size:15px;color:#71717a;">Un amministratore ti ha invitato su <strong>Shift Scheduler</strong></p>
  </td></tr>
  <tr><td style="padding:0 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:12px;padding:20px;">
      <tr><td style="padding:6px 20px;font-size:14px;color:#71717a;">Store</td><td style="padding:6px 20px;font-size:14px;font-weight:600;color:#18181b;text-align:right;">${storeName}</td></tr>
      <tr><td style="padding:6px 20px;font-size:14px;color:#71717a;">Ruolo</td><td style="padding:6px 20px;font-size:14px;font-weight:600;color:#18181b;text-align:right;">${roleName}</td></tr>
      <tr><td style="padding:6px 20px;font-size:14px;color:#71717a;">Reparto</td><td style="padding:6px 20px;font-size:14px;font-weight:600;color:#18181b;text-align:right;">${deptName}</td></tr>
      <tr><td style="padding:6px 20px;font-size:14px;color:#71717a;">Scade il</td><td style="padding:6px 20px;font-size:14px;font-weight:600;color:#18181b;text-align:right;">${expiresDate}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:32px 36px;text-align:center;">
    <a href="${inviteUrl}" style="display:inline-block;background:#18181b;color:#ffffff;font-size:16px;font-weight:600;padding:16px 48px;border-radius:12px;text-decoration:none;">Accetta invito</a>
  </td></tr>
  <tr><td style="padding:0 36px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#a1a1aa;">Oppure copia questo link:</p>
    <p style="margin:4px 0 0;font-size:12px;color:#71717a;word-break:break-all;">${inviteUrl}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Shift Scheduler <onboarding@resend.dev>",
        to: [inv.email],
        subject: "Sei stato invitato su Shift Scheduler",
        html: htmlBody,
      }),
    });

    const resendBody = await resendRes.json();
    if (!resendRes.ok) {
      throw new Error(`Resend error [${resendRes.status}]: ${JSON.stringify(resendBody)}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-invite-email error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
