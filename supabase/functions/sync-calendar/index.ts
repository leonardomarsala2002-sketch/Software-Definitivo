// sync-calendar — Edge Function FASE 6
// Sincronizza i turni pubblicati su Google Calendar.
// Se Google Calendar non è configurato, risponde con isSkipped: true (non bloccante).
//
// POST body:
//   action:    "create" | "update" | "delete"
//   user_id:   UUID del dipendente
//   store_id:  UUID del negozio
//   shift_id:  UUID del turno (per create/update)
//   shift:     { date, start_time, end_time, department } (per create/update)
//   google_appointment_id: UUID in calendar_appointments (per update/delete)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAuth, hasStoreAccess } from "../_shared/auth.ts";
import {
  isGoogleCalendarEnabled,
  getGoogleCalendarConfig,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../_shared/google-calendar/adapter.ts";

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

  // Se Google Calendar non è configurato, risponde subito senza errore
  if (!isGoogleCalendarEnabled()) {
    return json({ isSkipped: true, reason: "Google Calendar non configurato" });
  }

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
  const targetUserId = (body.user_id as string) ?? userId;

  if (!action || !storeId) {
    return json({ error: "action e store_id sono richiesti" }, 400);
  }
  if (!["create", "update", "delete"].includes(action)) {
    return json({ error: "action deve essere create, update o delete" }, 400);
  }

  const hasAccess = await hasStoreAccess(adminClient, userId, storeId, role);
  if (!hasAccess) return json({ error: "Accesso non autorizzato" }, 403);

  const config = getGoogleCalendarConfig()!;

  try {
    // ─── CREATE ──────────────────────────────────────────────────────────────
    if (action === "create") {
      const shift = body.shift as { date: string; start_time: string; end_time: string; department?: string };
      const shiftId = body.shift_id as string;

      if (!shift || !shiftId) return json({ error: "shift e shift_id sono richiesti per create" }, 400);

      // Recupera nome dipendente
      const { data: emp } = await adminClient
        .from("employee_details")
        .select("first_name, last_name")
        .eq("user_id", targetUserId)
        .single();

      const empName = emp ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() : "Dipendente";
      const title   = `Turno ${empName}${shift.department ? ` — ${shift.department}` : ""}`;

      const startAt = `${shift.date}T${shift.start_time}+02:00`;
      const endAt   = `${shift.date}T${shift.end_time}+02:00`;

      const googleEventId = await createCalendarEvent(config, {
        title,
        description: `Turno generato automaticamente per ${empName}`,
        start: startAt,
        end:   endAt,
      });

      // Salva in calendar_appointments
      const { data: appt, error: insertErr } = await adminClient
        .from("calendar_appointments")
        .insert({
          user_id:         targetUserId,
          store_id:        storeId,
          google_event_id: googleEventId,
          type:            "shift",
          title,
          start_at:        startAt,
          end_at:          endAt,
          synced_at:       new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`);

      return json({ success: true, appointmentId: (appt as { id: string }).id, googleEventId });
    }

    // ─── UPDATE ──────────────────────────────────────────────────────────────
    if (action === "update") {
      const apptId = body.google_appointment_id as string;
      const shift  = body.shift as { date?: string; start_time?: string; end_time?: string };

      if (!apptId) return json({ error: "google_appointment_id è richiesto per update" }, 400);

      const { data: appt } = await adminClient
        .from("calendar_appointments")
        .select("google_event_id")
        .eq("id", apptId)
        .single();

      if (!appt?.google_event_id) return json({ error: "Appuntamento non trovato" }, 404);

      const updates: Record<string, unknown> = {};
      if (shift?.date && shift?.start_time) updates.start = `${shift.date}T${shift.start_time}+02:00`;
      if (shift?.date && shift?.end_time)   updates.end   = `${shift.date}T${shift.end_time}+02:00`;

      await updateCalendarEvent(config, appt.google_event_id, updates);

      await adminClient
        .from("calendar_appointments")
        .update({ synced_at: new Date().toISOString(), ...updates })
        .eq("id", apptId);

      return json({ success: true });
    }

    // ─── DELETE ──────────────────────────────────────────────────────────────
    if (action === "delete") {
      const apptId = body.google_appointment_id as string;
      if (!apptId) return json({ error: "google_appointment_id è richiesto per delete" }, 400);

      const { data: appt } = await adminClient
        .from("calendar_appointments")
        .select("google_event_id")
        .eq("id", apptId)
        .single();

      if (appt?.google_event_id) {
        await deleteCalendarEvent(config, appt.google_event_id);
      }

      await adminClient.from("calendar_appointments").delete().eq("id", apptId);

      return json({ success: true });
    }

  } catch (err: any) {
    console.error("[sync-calendar] error:", err.message);
    return json({ error: `Errore sincronizzazione calendario: ${err.message}` }, 500);
  }

  return json({ error: "Azione non riconosciuta" }, 400);
});
