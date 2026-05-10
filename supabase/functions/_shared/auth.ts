import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type AppRole = "super_admin" | "admin" | "store_manager" | "employee";

export const MANAGER_ROLES: AppRole[] = ["super_admin", "admin", "store_manager"];

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface AuthResult {
  userId: string;
  role: AppRole;
  adminClient: ReturnType<typeof createClient>;
}

/**
 * Verifies Bearer token, loads user identity and role from DB.
 * Returns AuthResult on success, or a Response with 401/403 on failure.
 *
 * @param req - Incoming request
 * @param allowedRoles - Which roles are permitted. Defaults to manager roles (super_admin, admin, store_manager).
 */
export async function requireAuth(
  req: Request,
  allowedRoles: AppRole[] = MANAGER_ROLES,
): Promise<AuthResult | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: role } = await adminClient.rpc("get_user_role", {
    _user_id: userData.user.id,
  });

  if (!allowedRoles.includes(role as AppRole)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { userId: userData.user.id, role: role as AppRole, adminClient };
}

/**
 * Checks whether a user has access to a given store.
 * super_admin bypasses the check.
 */
export async function hasStoreAccess(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  storeId: string,
  role: AppRole,
): Promise<boolean> {
  if (role === "super_admin") return true;
  const { data } = await adminClient.rpc("is_store_member", {
    _user_id: userId,
    _store_id: storeId,
  });
  return !!data;
}

/**
 * Checks whether a caller has exceeded the rate limit for a given key.
 * Uses a sliding window: counts hits in the last `windowSeconds` seconds.
 * Returns a 429 Response if the limit is exceeded, otherwise records the hit and returns null.
 *
 * @param adminClient - Service role client (bypasses RLS)
 * @param key         - Unique identifier for the rate limit bucket (e.g. "publish-shifts:userId:storeId")
 * @param maxHits     - Max allowed hits in the window (default: 10)
 * @param windowSeconds - Rolling window size in seconds (default: 60)
 */
export async function checkRateLimit(
  adminClient: ReturnType<typeof createClient>,
  key: string,
  maxHits = 10,
  windowSeconds = 60,
): Promise<Response | null> {
  try {
    const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { count } = await adminClient
      .from("rate_limit_log")
      .select("id", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", since);

    if ((count ?? 0) >= maxHits) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Riprova tra poco." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await adminClient.from("rate_limit_log").insert({ key });

    // Best-effort cleanup of old entries for this key (non-blocking)
    adminClient
      .from("rate_limit_log")
      .delete()
      .eq("key", key)
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .then(() => {})
      .catch(() => {});

    return null;
  } catch {
    return null;
  }
}

/**
 * Writes an entry to audit_logs via admin client (bypasses RLS).
 */
export async function writeAuditLog(
  adminClient: ReturnType<typeof createClient>,
  params: {
    userId: string;
    userName?: string | null;
    role?: string | null;
    storeId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
    req?: Request;
  },
): Promise<void> {
  try {
    await adminClient.from("audit_logs").insert({
      user_id: params.userId,
      user_name: params.userName ?? null,
      role: params.role ?? null,
      store_id: params.storeId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      details: params.details ?? {},
      ip_address: params.req?.headers.get("x-forwarded-for") ?? null,
      user_agent: params.req?.headers.get("user-agent") ?? null,
    });
  } catch (err) {
    console.error("audit_log insert failed:", err);
  }
}
