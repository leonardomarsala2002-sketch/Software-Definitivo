import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Valid status transitions
const VALID_STATUSES = ["pending", "accepted", "rejected", "modified", "cancelled", "completed"];
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:   ["accepted", "rejected", "modified", "cancelled"],
  modified:  ["accepted", "rejected", "cancelled"],
  accepted:  ["completed", "cancelled"],
  rejected:  [],       // terminal
  cancelled: [],       // terminal
  completed: [],       // terminal
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Role check
    const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: userId });
    if (callerRole !== "super_admin" && callerRole !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { request_id, status } = await req.json();
    if (!request_id || !status) {
      return new Response(JSON.stringify({ error: "request_id e status sono obbligatori" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate status value
    if (!VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ error: `Status non valido. Valori ammessi: ${VALID_STATUSES.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing request
    const { data: existing, error: fetchErr } = await adminClient
      .from("lending_requests")
      .select("id, status, proposer_store_id, receiver_store_id, proposer_user_id, target_user_id, date")
      .eq("id", request_id)
      .single();

    if (fetchErr || !existing) {
      return new Response(JSON.stringify({ error: "Richiesta non trovata" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate state transition
    const allowed = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      return new Response(JSON.stringify({
        error: `Transizione non valida: da "${existing.status}" a "${status}". Transizioni permesse: ${allowed.join(", ") || "nessuna (stato terminale)"}`,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has access to one of the two stores (unless super_admin)
    if (callerRole === "admin") {
      const [{ data: m1 }, { data: m2 }] = await Promise.all([
        adminClient.rpc("is_store_member", { _user_id: userId, _store_id: existing.proposer_store_id }),
        adminClient.rpc("is_store_member", { _user_id: userId, _store_id: existing.receiver_store_id }),
      ]);
      if (!m1 && !m2) {
        return new Response(JSON.stringify({ error: "Non hai accesso a questa richiesta" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update status
    const { error: updateErr } = await adminClient
      .from("lending_requests")
      .update({
        status,
        last_modified_by: userId,
        last_modified_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    if (updateErr) throw new Error(updateErr.message);

    // Notify the other party
    const isProposerSide = await adminClient.rpc("is_store_member", {
      _user_id: userId, _store_id: existing.proposer_store_id,
    });
    const notifyStoreId = isProposerSide.data ? existing.receiver_store_id : existing.proposer_store_id;

    // Find admins of the other store to notify
    const { data: otherAdmins } = await adminClient
      .from("user_store_assignments").select("user_id").eq("store_id", notifyStoreId);

    const statusLabels: Record<string, string> = {
      accepted: "accettata", rejected: "rifiutata", modified: "modificata",
      cancelled: "annullata", completed: "completata",
    };

    if (otherAdmins) {
      const notifications = [];
      for (const a of otherAdmins) {
        const { data: role } = await adminClient.rpc("get_user_role", { _user_id: a.user_id });
        if (role === "admin" || role === "super_admin") {
          notifications.push({
            user_id: a.user_id,
            store_id: notifyStoreId,
            type: "lending_request",
            title: "Aggiornamento richiesta prestito",
            message: `La richiesta di prestito per il ${existing.date} è stata ${statusLabels[status] ?? status}.`,
            link: "/team-calendar",
          });
        }
      }
      if (notifications.length > 0) {
        await adminClient.from("notifications").insert(notifications);
      }
    }

    return new Response(JSON.stringify({ ok: true, new_status: status }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("patch-lending-request-status error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
