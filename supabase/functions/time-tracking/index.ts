// time-tracking — Edge Function FASE 6
// Registra timbrature (clock_in/out, break) via ZConnect o modalità demo.
// Se ZConnect non è configurato, usa automaticamente la demo.
//
// POST body:
//   action:      "clock_in" | "clock_out" | "break_start" | "break_end"
//   store_id:    UUID del negozio
//   shift_id?:   UUID del turno (opzionale ma consigliato)
//   timestamp?:  ISO 8601 (default: now)
//   notes?:      note libere

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAuth, hasStoreAccess } from "../_shared/auth.ts";
import { createTimeTrackingProvider, type TimeTrackingEventType } from "../_shared/time-tracking/adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VALID_ACTIONS: TimeTrackingEventType[] = ["clock_in", "clock_out", "break_start", "break_end"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;
  const { userId, role, adminClient } = authResult;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const action  = body.action  as string;
  const storeId = body.store_id as string;

  if (!action || !storeId) {
    return json({ error: "action e store_id sono richiesti" }, 400);
  }
  if (!VALID_ACTIONS.includes(action as TimeTrackingEventType)) {
    return json({ error: `action deve essere uno di: ${VALID_ACTIONS.join(", ")}` }, 400);
  }

  // I dipendenti possono timbrare solo nel proprio store
  const hasAccess = await hasStoreAccess(adminClient, userId, storeId, role);
  if (!hasAccess) return json({ error: "Accesso al negozio non autorizzato" }, 403);

  const provider = createTimeTrackingProvider(adminClient);

  try {
    const result = await provider.record({
      employeeId: userId,
      storeId,
      shiftId:    body.shift_id   as string | undefined,
      type:       action as TimeTrackingEventType,
      timestamp:  body.timestamp  as string | undefined,
      notes:      body.notes      as string | undefined,
    });

    return json({
      success:   result.success,
      eventId:   result.eventId,
      timestamp: result.timestamp,
      provider:  result.provider,
      isDemo:    result.isDemo,
    });

  } catch (err: any) {
    console.error("[time-tracking] record error:", err.message);
    return json({ error: `Errore registrazione timbratura: ${err.message}` }, 500);
  }
});
