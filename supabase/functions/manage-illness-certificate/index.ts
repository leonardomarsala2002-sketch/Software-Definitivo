import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sendNotification } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
  const resendKey      = Deno.env.get("RESEND_API_KEY");
  const publicAppUrl   = Deno.env.get("PUBLIC_APP_URL");
  const twilioSid      = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken    = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom     = Deno.env.get("TWILIO_WHATSAPP_FROM");

  const env = { resendApiKey: resendKey, publicAppUrl, twilioAccountSid: twilioSid, twilioAuthToken: twilioToken, twilioFromNumber: twilioFrom };

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: user.id });
  const isManager = ["admin", "super_admin", "store_manager"].includes(callerRole ?? "");

  // ─────────────────────────────────────────────────────────────────────────
  // GET — lista certificati
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const url     = new URL(req.url);
    const storeId = url.searchParams.get("store_id");
    const status  = url.searchParams.get("status");

    if (isManager && storeId) {
      let q = adminClient
        .from("illness_certificates")
        .select("*, profiles:user_id(full_name, email)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ certificates: data });
    }

    const { data, error } = await adminClient
      .from("illness_certificates")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false });

    if (error) return json({ error: error.message }, 500);
    return json({ certificates: data });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST — azioni: submit | validate
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON" }, 400);

    const { action } = body;

    // ── submit: dipendente invia certificato ─────────────────────────────
    if (action === "submit") {
      const { store_id, start_date, end_date, storage_path, notes } = body;

      if (!store_id || !start_date || !end_date || !storage_path) {
        return json({ error: "store_id, start_date, end_date e storage_path sono obbligatori" }, 400);
      }
      if (new Date(end_date) < new Date(start_date)) {
        return json({ error: "end_date deve essere >= start_date" }, 400);
      }

      // Verifica appartenenza store
      const { data: assign } = await adminClient
        .from("user_store_assignments")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("store_id", store_id)
        .maybeSingle();
      if (!assign) return json({ error: "Utente non appartiene a questo store" }, 403);

      // URL firmato valido 1 anno. Se scade, il manager può rigenerarlo scaricando
      // il file via storage_path + nuovo signed URL (endpoint separato se necessario).
      const { data: signedUrl, error: urlErr } = await adminClient.storage
        .from("illness-certificates")
        .createSignedUrl(storage_path, 60 * 60 * 24 * 365);

      if (urlErr) return json({ error: `Errore URL certificato: ${urlErr.message}` }, 500);

      const { data: cert, error: insertErr } = await adminClient
        .from("illness_certificates")
        .insert({
          user_id:         user.id,
          store_id,
          start_date,
          end_date,
          certificate_url: signedUrl.signedUrl,
          storage_path,
          status:          "pending",
          notes:           notes ?? null,
        })
        .select()
        .single();

      if (insertErr) return json({ error: insertErr.message }, 500);

      // Crea richieste malattia pending per ogni giorno del range
      const start = new Date(start_date + "T00:00:00Z");
      const end   = new Date(end_date   + "T00:00:00Z");
      const pendingRequests: Record<string, unknown>[] = [];
      const cur = new Date(start);
      while (cur <= end) {
        pendingRequests.push({
          user_id:               user.id,
          store_id,
          request_type:          "malattia",
          request_date:          cur.toISOString().split("T")[0],
          status:                "pending",
          illness_certificate_id: cert.id,
        });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      await adminClient.from("time_off_requests").insert(pendingRequests);

      // Notifica manager
      const { data: assignments } = await adminClient
        .from("user_store_assignments")
        .select("user_id")
        .eq("store_id", store_id);

      if (assignments?.length) {
        const mgrIds = assignments.map((a: { user_id: string }) => a.user_id);
        const { data: mgrRoles } = await adminClient
          .from("user_roles")
          .select("user_id")
          .in("user_id", mgrIds)
          .in("role", ["admin", "super_admin", "store_manager"]);

        const { data: empProfile } = await adminClient
          .from("profiles").select("full_name").eq("id", user.id).single();

        const days = pendingRequests.length;
        for (const mgr of mgrRoles ?? []) {
          await sendNotification(adminClient, {
            userId:  mgr.user_id,
            storeId: store_id,
            type:    "illness_certificate_submitted",
            title:   "Certificato malattia ricevuto",
            body:    `${empProfile?.full_name ?? "Un dipendente"} ha caricato un certificato medico (${days} giorn${days === 1 ? "o" : "i"}): ${start_date} → ${end_date}.`,
            link:    "/requests",
          }, ["in-app"], env).catch(e => console.error("[notify]", e));
        }
      }

      return json({ ok: true, certificate: cert, days_affected: pendingRequests.length }, 201);
    }

    // ── validate: manager approva/rifiuta certificato ────────────────────
    if (action === "validate") {
      if (!isManager) return json({ error: "Forbidden" }, 403);

      const { certificate_id, status } = body;
      if (!certificate_id || !["approved", "rejected"].includes(status)) {
        return json({ error: "certificate_id e status (approved|rejected) obbligatori" }, 400);
      }

      // Verifica che il certificato appartenga a un store gestito dal caller
      const { data: certRow } = await adminClient
        .from("illness_certificates")
        .select("id, user_id, store_id, start_date, end_date, status")
        .eq("id", certificate_id)
        .single();

      if (!certRow) return json({ error: "Certificato non trovato" }, 404);

      if (callerRole === "store_manager") {
        const { data: storeAssign } = await adminClient
          .from("user_store_assignments")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("store_id", certRow.store_id)
          .maybeSingle();
        if (!storeAssign) return json({ error: "Forbidden: store non gestito" }, 403);
      }

      const { data: result, error: rpcErr } = await adminClient.rpc("validate_illness_certificate", {
        p_certificate_id: certificate_id,
        p_validator_id:   user.id,
        p_status:         status,
      });

      if (rpcErr) return json({ error: rpcErr.message }, 500);
      if (!result?.ok) return json({ error: result?.error ?? "Operazione fallita" }, 422);

      // Notifica al dipendente
      const { data: empProfile } = await adminClient
        .from("profiles")
        .select("full_name, email")
        .eq("id", certRow.user_id)
        .single();

      const isApproved = status === "approved";
      await sendNotification(adminClient, {
        userId:  certRow.user_id,
        storeId: certRow.store_id,
        type:    isApproved ? "illness_approved" : "illness_rejected",
        title:   isApproved ? "Malattia validata" : "Certificato rifiutato",
        body:    isApproved
          ? `Il tuo certificato medico (${certRow.start_date} → ${certRow.end_date}) è stato convalidato. I giorni di malattia sono registrati.`
          : `Il tuo certificato medico (${certRow.start_date} → ${certRow.end_date}) è stato rifiutato. Contatta il manager per chiarimenti.`,
        link: "/requests",
      }, ["in-app", "email"], env, { email: empProfile?.email ?? undefined }).catch(
        e => console.error("[notify]", e),
      );

      return json({ ok: true, days_affected: result?.days_affected ?? 0 });
    }

    return json({ error: "action non valida. Valori: submit, validate" }, 400);
  }

  return json({ error: "Method not allowed" }, 405);
});
