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

const LEAVE_TYPES = ["ferie", "permesso", "permesso_104"] as const;
type LeaveType = typeof LEAVE_TYPES[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

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

  const url      = new URL(req.url);
  const year     = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const storeId  = url.searchParams.get("store_id");
  const targetId = url.searchParams.get("user_id"); // manager può chiedere per un altro utente

  // Solo admin/manager possono richiedere il saldo di altri utenti
  let resolvedUserId = user.id;
  if (targetId && targetId !== user.id) {
    const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: user.id });
    if (!["admin", "super_admin", "store_manager"].includes(callerRole ?? "")) {
      return json({ error: "Forbidden" }, 403);
    }
    resolvedUserId = targetId;
  }

  if (!storeId) return json({ error: "store_id obbligatorio" }, 400);

  // Inizializza saldi se non esistono (idempotente)
  await adminClient.rpc("initialize_leave_balances", {
    p_user_id:  resolvedUserId,
    p_store_id: storeId,
    p_year:     year,
  });

  // Recupera saldi
  const { data: balances, error: balErr } = await adminClient
    .from("employee_leave_balances")
    .select("leave_type, total_hours, used_hours, updated_at")
    .eq("user_id", resolvedUserId)
    .eq("store_id", storeId)
    .eq("year", year);

  if (balErr) return json({ error: balErr.message }, 500);

  // Struttura la risposta per tipo
  const result: Record<
    LeaveType,
    { total_hours: number; used_hours: number; remaining_hours: number; updated_at: string | null }
  > = {
    ferie:        { total_hours: 0, used_hours: 0, remaining_hours: 0, updated_at: null },
    permesso:     { total_hours: 0, used_hours: 0, remaining_hours: 0, updated_at: null },
    permesso_104: { total_hours: 0, used_hours: 0, remaining_hours: 0, updated_at: null },
  };

  for (const row of balances ?? []) {
    const lt = row.leave_type as LeaveType;
    if (!LEAVE_TYPES.includes(lt)) continue;
    result[lt] = {
      total_hours:     Number(row.total_hours),
      used_hours:      Number(row.used_hours),
      remaining_hours: Math.max(0, Number(row.total_hours) - Number(row.used_hours)),
      updated_at:      row.updated_at,
    };
  }

  // Conteggio richieste approvate nell'anno per cross-check
  const { data: approvedRequests } = await adminClient
    .from("time_off_requests")
    .select("request_type, request_date")
    .eq("user_id", resolvedUserId)
    .eq("store_id", storeId)
    .eq("status", "approved")
    .in("request_type", ["ferie", "permesso", "permesso_104"])
    .gte("request_date", `${year}-01-01`)
    .lte("request_date", `${year}-12-31`);

  const requestCounts: Record<LeaveType, number> = {
    ferie: 0, permesso: 0, permesso_104: 0,
  };
  for (const r of approvedRequests ?? []) {
    const lt = r.request_type as LeaveType;
    if (LEAVE_TYPES.includes(lt)) requestCounts[lt]++;
  }

  return json({
    user_id:                  resolvedUserId,
    store_id:                 storeId,
    year,
    balances:                 result,
    // Count of approved leave requests per type (one entry = one request date, not hours).
    // Use balances[type].used_hours for the authoritative deduction figure.
    approved_request_counts:  requestCounts,
  });
});
