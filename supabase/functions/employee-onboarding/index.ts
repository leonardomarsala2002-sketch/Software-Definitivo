// Gestisce il questionario di preferenze turno del dipendente.
// GET  → restituisce le preferenze salvate (o defaults se non ancora compilato)
// POST → salva/aggiorna le preferenze e marca l'onboarding come completato

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── GET ─────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const url     = new URL(req.url);
    const storeId = url.searchParams.get("store_id");
    // Manager può leggere preferenze di un dipendente specifico
    const targetId = url.searchParams.get("user_id") ?? user.id;

    if (targetId !== user.id) {
      const { data: role } = await adminClient.rpc("get_user_role", { _user_id: user.id });
      if (!["admin", "super_admin", "store_manager"].includes(role ?? "")) {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const { data: prefs, error } = await adminClient
      .from("employee_preferences")
      .select("*")
      .eq("user_id", targetId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);

    if (!prefs) {
      // Restituisce defaults se non ancora compilato
      return json({
        onboarding_completed: false,
        preferences:          null,
        store_id:             storeId ?? null,
      });
    }

    return json({
      onboarding_completed: prefs.onboarding_completed,
      preferences:          prefs,
    });
  }

  // ─── POST ────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON" }, 400);

    const {
      store_id,
      preferred_shift_type,
      preferred_days_off,
      weekend_availability,
      prefers_opening,
      prefers_closing,
      recurring_limits,
      hour_distribution,
    } = body;

    if (!store_id) return json({ error: "store_id obbligatorio" }, 400);

    // Validazioni
    const VALID_SHIFT_TYPES = ["morning", "afternoon", "evening", "any", null, undefined];
    const VALID_WEEKEND    = ["available", "unavailable", "limited"];
    const VALID_DIST       = ["front_loaded", "even", "back_loaded", null, undefined];

    if (preferred_shift_type !== undefined && !VALID_SHIFT_TYPES.includes(preferred_shift_type)) {
      return json({ error: `preferred_shift_type non valido. Valori: morning, afternoon, evening, any` }, 400);
    }
    if (weekend_availability !== undefined && !VALID_WEEKEND.includes(weekend_availability)) {
      return json({ error: `weekend_availability non valido. Valori: ${VALID_WEEKEND.join(", ")}` }, 400);
    }
    if (hour_distribution !== undefined && !VALID_DIST.includes(hour_distribution)) {
      return json({ error: `hour_distribution non valido. Valori: front_loaded, even, back_loaded` }, 400);
    }
    if (preferred_days_off !== undefined && !Array.isArray(preferred_days_off)) {
      return json({ error: "preferred_days_off deve essere un array di numeri (0=Lun, 6=Dom)" }, 400);
    }

    const upsertData: Record<string, unknown> = {
      user_id:                user.id,
      store_id,
      onboarding_completed:   true,
      onboarding_completed_at: new Date().toISOString(),
    };

    if (preferred_shift_type !== undefined) upsertData.preferred_shift_type = preferred_shift_type;
    if (preferred_days_off   !== undefined) upsertData.preferred_days_off   = preferred_days_off;
    if (weekend_availability !== undefined) upsertData.weekend_availability = weekend_availability;
    if (prefers_opening      !== undefined) upsertData.prefers_opening      = !!prefers_opening;
    if (prefers_closing      !== undefined) upsertData.prefers_closing      = !!prefers_closing;
    if (recurring_limits     !== undefined) upsertData.recurring_limits     = recurring_limits;
    if (hour_distribution    !== undefined) upsertData.hour_distribution    = hour_distribution;

    const { data: prefs, error } = await adminClient
      .from("employee_preferences")
      .upsert(upsertData, { onConflict: "user_id" })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    // Aggiorna soft rules nel rule engine: le preferenze diventano input per SR001
    // (Le preferenze vengono lette da generate-optimized-schedule già in FASE 2 via employee_exceptions;
    //  employee_preferences è il dato canonico — nessuna azione aggiuntiva necessaria qui.)

    return json({ ok: true, preferences: prefs });
  }

  return json({ error: "Method not allowed" }, 405);
});
