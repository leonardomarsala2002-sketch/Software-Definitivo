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

    // Auth check
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

    // Verify caller is admin or super_admin
    const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: userId });
    if (callerRole !== "super_admin" && callerRole !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: solo admin possono creare richieste di prestito" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate body
    const body = await req.json();
    const { proposer_store_id, receiver_store_id, target_user_id, date, start_time, end_time, reason } = body;

    if (!proposer_store_id || !receiver_store_id || !target_user_id || !date) {
      return new Response(JSON.stringify({ error: "Campi obbligatori: proposer_store_id, receiver_store_id, target_user_id, date" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ error: "Formato data non valido (atteso YYYY-MM-DD)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate time format if provided (HH:MM or HH:MM:SS)
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    if (start_time && !timeRegex.test(start_time)) {
      return new Response(JSON.stringify({ error: "Formato start_time non valido (atteso HH:MM)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (end_time && !timeRegex.test(end_time)) {
      return new Response(JSON.stringify({ error: "Formato end_time non valido (atteso HH:MM)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Proposer and receiver must be different stores
    if (proposer_store_id === receiver_store_id) {
      return new Response(JSON.stringify({ error: "Lo store di origine e destinazione devono essere diversi" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is member of proposer store (unless super_admin)
    if (callerRole === "admin") {
      const { data: isMember } = await adminClient.rpc("is_store_member", { _user_id: userId, _store_id: proposer_store_id });
      if (!isMember) {
        return new Response(JSON.stringify({ error: "Non sei membro dello store proponente" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Verify both stores exist and are in the same city
    const { data: stores, error: storesErr } = await adminClient
      .from("stores").select("id, city, is_active").in("id", [proposer_store_id, receiver_store_id]);
    if (storesErr || !stores || stores.length !== 2) {
      return new Response(JSON.stringify({ error: "Uno o entrambi gli store non trovati" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const proposerStore = stores.find(s => s.id === proposer_store_id);
    const receiverStore = stores.find(s => s.id === receiver_store_id);
    if (!proposerStore?.is_active || !receiverStore?.is_active) {
      return new Response(JSON.stringify({ error: "Entrambi gli store devono essere attivi" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (proposerStore.city !== receiverStore.city) {
      return new Response(JSON.stringify({ error: "I prestiti sono possibili solo tra store della stessa città" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify target user is member of receiver store
    const { data: targetIsMember } = await adminClient.rpc("is_store_member", {
      _user_id: target_user_id, _store_id: receiver_store_id,
    });
    if (!targetIsMember) {
      return new Response(JSON.stringify({ error: "Il dipendente target non appartiene allo store ricevente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize reason (max 500 chars)
    const sanitizedReason = reason ? String(reason).trim().slice(0, 500) : null;

    // Insert the lending request
    const { data, error } = await adminClient.from("lending_requests").insert({
      proposer_store_id,
      receiver_store_id,
      proposer_user_id: userId,
      target_user_id,
      date,
      start_time: start_time || null,
      end_time: end_time || null,
      reason: sanitizedReason,
      status: "pending",
    }).select("id").single();

    if (error) {
      throw new Error(error.message);
    }

    // Notify receiver store admins
    const { data: receiverAdmins } = await adminClient
      .from("user_store_assignments").select("user_id").eq("store_id", receiver_store_id);
    const { data: proposerStoreName } = await adminClient
      .from("stores").select("name").eq("id", proposer_store_id).single();

    if (receiverAdmins) {
      const notifications = [];
      for (const admin of receiverAdmins) {
        // Check if the user is admin/super_admin
        const { data: role } = await adminClient.rpc("get_user_role", { _user_id: admin.user_id });
        if (role === "admin" || role === "super_admin") {
          notifications.push({
            user_id: admin.user_id,
            store_id: receiver_store_id,
            type: "lending_request",
            title: "Nuova richiesta di prestito",
            message: `${proposerStoreName?.name ?? "Uno store"} ha richiesto un prestito di personale per il ${date}.`,
            link: "/team-calendar",
          });
        }
      }
      if (notifications.length > 0) {
        await adminClient.from("notifications").insert(notifications);
      }
    }

    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-lending-request error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
