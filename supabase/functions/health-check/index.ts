/**
 * health-check — endpoint di monitoring per l'app.
 *
 * GET /functions/v1/health-check
 *
 * Risponde con 200 se tutto è ok, 503 se qualcosa non va.
 * Da chiamare con un cron esterno (es. UptimeRobot, BetterStack, cron job GitHub)
 * oppure dal dashboard Supabase come smoke test post-deploy.
 *
 * Non richiede autenticazione (chiave anonima sufficiente).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckResult {
  name: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

async function checkDatabase(supabase: ReturnType<typeof createClient>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from("stores").select("id").limit(1);
    return { name: "database", ok: !error, latencyMs: Date.now() - start, error: error?.message };
  } catch (err) {
    return { name: "database", ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkAuth(supabase: ReturnType<typeof createClient>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.auth.getSession();
    return { name: "auth", ok: !error, latencyMs: Date.now() - start, error: error?.message };
  } catch (err) {
    return { name: "auth", ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkAiGateway(): Promise<CheckResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return { name: "ai_gateway", ok: false, error: "GEMINI_API_KEY non configurata — fallback deterministico attivo" };
  }
  const start = Date.now();
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    return { name: "ai_gateway", ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { name: "ai_gateway", ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ status: "error", error: "Env vars Supabase mancanti" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const [dbCheck, authCheck, aiCheck] = await Promise.all([
    checkDatabase(supabase),
    checkAuth(supabase),
    checkAiGateway(),
  ]);

  const checks = [dbCheck, authCheck, aiCheck];
  const criticalFailed = checks.filter(c => !c.ok && c.name !== "ai_gateway");
  const overallOk = criticalFailed.length === 0;

  const body = {
    status: overallOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks: checks.reduce<Record<string, Omit<CheckResult, "name">>>((acc, c) => {
      acc[c.name] = { ok: c.ok, latencyMs: c.latencyMs, error: c.error };
      return acc;
    }, {}),
    // AI gateway non è critico — il fallback deterministico è attivo
    note: !aiCheck.ok
      ? "AI gateway non disponibile — generazione turni usa rule engine deterministico"
      : undefined,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: overallOk ? 200 : 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
