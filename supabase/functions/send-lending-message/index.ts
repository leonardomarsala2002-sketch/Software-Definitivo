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

    // Role check — admin or super_admin can send messages
    const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: userId });
    if (callerRole !== "super_admin" && callerRole !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: solo admin possono inviare messaggi" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { lending_request_id, message } = await req.json();

    if (!lending_request_id) {
      return new Response(JSON.stringify({ error: "lending_request_id obbligatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate message text
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Il messaggio non può essere vuoto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sanitizedMessage = message.trim().slice(0, 2000); // max 2000 chars

    // Verify the lending request exists and caller has access
    const { data: lr, error: lrErr } = await adminClient
      .from("lending_requests")
      .select("id, proposer_store_id, receiver_store_id, status")
      .eq("id", lending_request_id)
      .single();

    if (lrErr || !lr) {
      return new Response(JSON.stringify({ error: "Richiesta di prestito non trovata" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Don't allow messages on terminal requests
    if (["rejected", "cancelled", "completed"].includes(lr.status)) {
      return new Response(JSON.stringify({ error: `Non è possibile inviare messaggi su una richiesta in stato "${lr.status}"` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is member of one of the two stores (unless super_admin)
    if (callerRole === "admin") {
      const [{ data: m1 }, { data: m2 }] = await Promise.all([
        adminClient.rpc("is_store_member", { _user_id: userId, _store_id: lr.proposer_store_id }),
        adminClient.rpc("is_store_member", { _user_id: userId, _store_id: lr.receiver_store_id }),
      ]);
      if (!m1 && !m2) {
        return new Response(JSON.stringify({ error: "Non hai accesso a questa richiesta" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert message
    const { error: insertErr } = await adminClient.from("lending_request_messages").insert({
      lending_request_id,
      sender_user_id: userId,
      message: sanitizedMessage,
    });

    if (insertErr) throw new Error(insertErr.message);

    // Notify the other party's admins
    const isProposerSide = await adminClient.rpc("is_store_member", {
      _user_id: userId, _store_id: lr.proposer_store_id,
    });
    const notifyStoreId = isProposerSide.data ? lr.receiver_store_id : lr.proposer_store_id;

    const { data: otherAdmins } = await adminClient
      .from("user_store_assignments").select("user_id").eq("store_id", notifyStoreId);

    if (otherAdmins) {
      const { data: senderProfile } = await adminClient
        .from("profiles").select("full_name").eq("id", userId).single();

      const notifications = [];
      for (const a of otherAdmins) {
        if (a.user_id === userId) continue; // don't notify self
        const { data: role } = await adminClient.rpc("get_user_role", { _user_id: a.user_id });
        if (role === "admin" || role === "super_admin") {
          notifications.push({
            user_id: a.user_id,
            store_id: notifyStoreId,
            type: "lending_request",
            title: "Nuovo messaggio prestito",
            message: `${senderProfile?.full_name ?? "Un admin"}: "${sanitizedMessage.slice(0, 80)}${sanitizedMessage.length > 80 ? "…" : ""}"`,
            link: "/team-calendar",
          });
        }
      }
      if (notifications.length > 0) {
        await adminClient.from("notifications").insert(notifications);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-lending-message error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
