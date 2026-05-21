import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Rigenera i turni dall'imprevisto (malattia, modifica) fino a fine mese,
// preservando i turni pubblicati precedenti a `from_date`.
//
// Body: { store_id, from_date, department? }
//   from_date — data da cui rigenerare (inclusa). Di solito "oggi" o la data
//               in cui è stata approvata la malattia/modifica.
//   department — opzionale: rigenera solo sala o cucina; default entrambi.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Ultimo giorno del mese della data passata (UTC)
function lastDayOfMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return getDateStr(lastDay);
}

// Primo giorno del mese della data passata (UTC)
function firstDayOfMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return getDateStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: user.id });
  if (!["super_admin", "admin", "store_manager"].includes(callerRole ?? "")) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const { store_id, from_date, department } = body;

  if (!store_id || !from_date) {
    return json({ error: "store_id e from_date sono obbligatori" }, 400);
  }

  // Verifica che il caller gestisca questo store
  if (callerRole === "store_manager") {
    const { data: assign } = await adminClient
      .from("user_store_assignments")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("store_id", store_id)
      .maybeSingle();
    if (!assign) return json({ error: "Forbidden: store non gestito" }, 403);
  }

  const periodStart = firstDayOfMonth(from_date); // 1° del mese corrente
  const periodEnd   = lastDayOfMonth(from_date);  // ultimo giorno del mese corrente

  // Recupera tutti i turni pubblicati PRIMA di from_date per questo store+mese
  // → questi rimangono invariati (locked)
  const { data: lockedShifts, error: lockedErr } = await adminClient
    .from("shifts")
    .select("id")
    .eq("store_id", store_id)
    .eq("status", "published")
    .gte("date", periodStart)
    .lt("date", from_date);

  if (lockedErr) return json({ error: lockedErr.message }, 500);

  const lockedIds = (lockedShifts ?? []).map((s: { id: string }) => s.id);

  console.log(
    `[PATCH-MONTHLY] store=${store_id} from=${from_date} period=${periodStart}..${periodEnd} ` +
    `locked=${lockedIds.length} dept=${department ?? "all"}`
  );

  // Chiama generate-optimized-schedule in modalità rebalance
  // da from_date fino a fine mese, preservando i turni locked.
  const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-optimized-schedule`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      store_id,
      period_start_date: from_date,
      period_end_date:   periodEnd,
      mode:              "rebalance",
      locked_shift_ids:  lockedIds,
      department:        department ?? undefined,
    }),
  });

  const genBody = await genRes.json();
  if (!genRes.ok) {
    console.error("[PATCH-MONTHLY] Generator error:", genBody);
    return json({ error: genBody.error ?? "Errore durante la rigenerazione" }, 500);
  }

  // Aggiorna lo stato del periodo nel DB (generazione completata — draft pronto per revisione)
  await adminClient.rpc("upsert_schedule_period", {
    p_store_id:     store_id,
    p_period_start: periodStart,
    p_period_end:   periodEnd,
    p_status:       "generated",
  });

  const depts = genBody.departments ?? [];
  const totalShifts = depts.reduce((acc: number, d: any) => acc + (d.shifts ?? 0), 0);
  const totalUncovered = depts.reduce((acc: number, d: any) => acc + (d.uncovered ?? 0), 0);

  return json({
    ok: true,
    from_date,
    period_end: periodEnd,
    locked_shifts_preserved: lockedIds.length,
    departments: depts,
    total_shifts: totalShifts,
    uncovered: totalUncovered,
  });
});
