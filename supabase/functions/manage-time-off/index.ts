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

// Deadline mensile: 7 giorni prima del primo del mese a cui appartiene la data richiesta.
// Esempio: richiesta per giugno → deadline = 25 maggio (= 1 giugno - 7 giorni) a fine giornata.
function getMonthlyDeadline(requestDate: string): Date {
  const d = new Date(requestDate + "T00:00:00Z");
  const firstOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  firstOfMonth.setUTCDate(firstOfMonth.getUTCDate() - 7);
  firstOfMonth.setUTCHours(23, 59, 59, 999);
  return firstOfMonth;
}

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

  // Ruolo chiamante
  const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: user.id });
  const isManager = ["admin", "super_admin", "store_manager"].includes(callerRole ?? "");

  // ─────────────────────────────────────────────────────────────────────────
  // GET — lista richieste
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const storeId  = url.searchParams.get("store_id");
    const statusF  = url.searchParams.get("status");
    const fromDate = url.searchParams.get("from");
    const toDate   = url.searchParams.get("to");

    if (isManager && storeId) {
      // Manager: lista richieste del proprio store
      let q = adminClient
        .from("time_off_requests")
        .select("*, profiles:user_id(full_name, email)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (statusF) q = q.eq("status", statusF);
      if (fromDate) q = q.gte("request_date", fromDate);
      if (toDate)   q = q.lte("request_date", toDate);

      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ requests: data });
    }

    // Dipendente: lista proprie richieste
    let q = adminClient
      .from("time_off_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("request_date", { ascending: false });

    if (statusF) q = q.eq("status", statusF);
    if (fromDate) q = q.gte("request_date", fromDate);
    if (toDate)   q = q.lte("request_date", toDate);

    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);
    return json({ requests: data });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST — crea richiesta (dipendente)
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON" }, 400);

    const { store_id, request_type, request_date, notes, department } = body;

    const VALID_TYPES = ["giorno_libero", "mattina_libera", "sera_libera", "ferie", "permesso", "permesso_104", "malattia"];
    if (!store_id || !request_type || !request_date) {
      return json({ error: "store_id, request_type e request_date sono obbligatori" }, 400);
    }
    if (!VALID_TYPES.includes(request_type)) {
      return json({ error: `request_type non valido. Valori: ${VALID_TYPES.join(", ")}` }, 400);
    }

    // Verifica appartenenza al store
    const { data: assignment } = await adminClient
      .from("user_store_assignments")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("store_id", store_id)
      .maybeSingle();
    if (!assignment) return json({ error: "Utente non appartiene a questo store" }, 403);

    // Controllo deadline mensile (non per malattia: sempre accettata)
    if (request_type !== "malattia") {
      const deadline = getMonthlyDeadline(request_date);
      if (new Date() > deadline) {
        const deadlineIso = deadline.toISOString().split("T")[0];
        const [dy, dm, dd] = deadlineIso.split("-");
        const deadlineIt = `${dd}/${dm}/${dy}`;
        return json({
          error: `Termine di invio superato. Le richieste per questo mese devono essere inviate entro il ${deadlineIt}.`,
          deadline: deadlineIso,
        }, 422);
      }
    }

    // Controllo saldo (per tipi tracciati)
    if (["ferie", "permesso", "permesso_104"].includes(request_type)) {
      const { data: rules } = await adminClient
        .from("store_rules")
        .select("block_over_balance")
        .eq("store_id", store_id)
        .maybeSingle();

      if (rules?.block_over_balance) {
        const year = new Date(request_date).getFullYear();
        const { data: balance } = await adminClient
          .from("employee_leave_balances")
          .select("total_hours, used_hours")
          .eq("user_id", user.id)
          .eq("store_id", store_id)
          .eq("year", year)
          .eq("leave_type", request_type)
          .maybeSingle();

        if (balance) {
          const remaining = balance.total_hours - balance.used_hours;
          // Stima ore per questa richiesta (approssimazione: 8h/giorno)
          if (remaining < 4) {
            return json({
              error: "Saldo insufficiente per questo tipo di assenza.",
              remaining_hours: remaining,
            }, 422);
          }
        }
      }
    }

    const { data: request, error: insertErr } = await adminClient
      .from("time_off_requests")
      .insert({
        user_id:      user.id,
        store_id,
        request_type,
        request_date,
        department:   department ?? null,
        notes:        notes ?? null,
        status:       "pending",
      })
      .select()
      .single();

    if (insertErr) return json({ error: insertErr.message }, 500);

    // Notifica ai manager del store: utenti assegnati al negozio con ruolo manager
    // + super_admin globali non necessariamente presenti in user_store_assignments.
    const [storeAssignRes, superAdminRes] = await Promise.all([
      adminClient
        .from("user_store_assignments")
        .select("user_id")
        .eq("store_id", store_id),
      adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin"),
    ]);

    const assignments = storeAssignRes.data;

    if (assignments || superAdminRes.data?.length) {
      const assignedIds = (assignments ?? []).map((a: { user_id: string }) => a.user_id);
      // Filter assigned users to manager/store_manager roles only
      const { data: managerRoles } = assignedIds.length > 0
        ? await adminClient
            .from("user_roles")
            .select("user_id")
            .in("user_id", assignedIds)
            .in("role", ["admin", "store_manager"])
        : { data: [] };

      // Merge with super_admins (deduplicated)
      const managerIdSet = new Set([
        ...(managerRoles ?? []).map((r: { user_id: string }) => r.user_id),
        ...(superAdminRes.data ?? []).map((r: { user_id: string }) => r.user_id),
      ]);
      const managerRolesMerged = [...managerIdSet].map(uid => ({ user_id: uid }));

      // Replace "managerRoles" variable reference below
      const _managerRoles = managerRolesMerged;

      const { data: requesterProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const typeLabel: Record<string, string> = {
        giorno_libero: "Giorno libero", mattina_libera: "Mattina libera",
        sera_libera: "Sera libera", ferie: "Ferie", permesso: "Permesso",
        permesso_104: "Permesso 104", malattia: "Malattia",
      };

      for (const mgr of _managerRoles) {
        if (mgr.user_id === user.id) continue; // non notificare chi ha creato la richiesta
        await sendNotification(adminClient, {
          userId:  mgr.user_id,
          storeId: store_id,
          type:    "time_off_request_new",
          title:   `Nuova richiesta: ${typeLabel[request_type] ?? request_type}`,
          body:    `${requesterProfile?.full_name ?? "Un dipendente"} ha richiesto ${typeLabel[request_type] ?? request_type} il ${request_date}.`,
          link:    "/requests",
        }, ["in-app"], env).catch(e => console.error("[notify] manager:", e));
      }
    }

    return json({ ok: true, request }, 201);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH — approva o rifiuta (manager)
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "PATCH") {
    if (!isManager) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON" }, 400);

    const { request_id, action } = body;
    if (!request_id || !["approve", "reject"].includes(action)) {
      return json({ error: "request_id e action (approve|reject) obbligatori" }, 400);
    }

    // Verifica che la richiesta appartenga a uno store gestito dal caller
    const { data: reqRow } = await adminClient
      .from("time_off_requests")
      .select("id, user_id, store_id, request_type, request_date, status")
      .eq("id", request_id)
      .single();

    if (!reqRow) return json({ error: "Richiesta non trovata" }, 404);

    if (callerRole === "store_manager") {
      const { data: storeAssign } = await adminClient
        .from("user_store_assignments")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("store_id", reqRow.store_id)
        .maybeSingle();
      if (!storeAssign) return json({ error: "Forbidden: store non gestito" }, 403);
    }

    const rpcName = action === "approve" ? "approve_time_off_request" : "reject_time_off_request";
    const { data: result, error: rpcErr } = await adminClient.rpc(rpcName, {
      p_request_id:  request_id,
      p_reviewer_id: user.id,
    });

    if (rpcErr) return json({ error: rpcErr.message }, 500);
    if (!result?.ok) return json({ error: result?.error ?? "Operazione fallita" }, 422);

    // Notifica al dipendente
    const { data: empProfile } = await adminClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", reqRow.user_id)
      .single();

    const typeLabel: Record<string, string> = {
      giorno_libero: "Giorno libero", mattina_libera: "Mattina libera",
      sera_libera: "Sera libera", ferie: "Ferie", permesso: "Permesso",
      permesso_104: "Permesso 104", malattia: "Malattia",
    };

    const isApproved = action === "approve";
    await sendNotification(adminClient, {
      userId:  reqRow.user_id,
      storeId: reqRow.store_id,
      type:    isApproved ? "time_off_approved" : "time_off_rejected",
      title:   isApproved
        ? `Richiesta approvata: ${typeLabel[reqRow.request_type] ?? reqRow.request_type}`
        : `Richiesta rifiutata: ${typeLabel[reqRow.request_type] ?? reqRow.request_type}`,
      body: isApproved
        ? `La tua richiesta di ${typeLabel[reqRow.request_type] ?? reqRow.request_type} per il ${reqRow.request_date} è stata approvata.`
        : `La tua richiesta di ${typeLabel[reqRow.request_type] ?? reqRow.request_type} per il ${reqRow.request_date} è stata rifiutata.`,
      link: "/personal-calendar",
    }, ["in-app", "email"], env, { email: empProfile?.email ?? undefined }).catch(
      e => console.error("[notify] employee:", e),
    );

    return json({ ok: true, action });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE — cancella propria richiesta pending
  // ─────────────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const requestId = url.searchParams.get("request_id");
    if (!requestId) return json({ error: "request_id obbligatorio" }, 400);

    const { data: reqRow } = await adminClient
      .from("time_off_requests")
      .select("id, user_id, status")
      .eq("id", requestId)
      .single();

    if (!reqRow) return json({ error: "Richiesta non trovata" }, 404);
    if (reqRow.user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (reqRow.status !== "pending") {
      return json({ error: "Solo le richieste in stato 'pending' possono essere cancellate" }, 422);
    }

    const { error: delErr } = await adminClient
      .from("time_off_requests")
      .delete()
      .eq("id", requestId);

    if (delErr) return json({ error: delErr.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
});
