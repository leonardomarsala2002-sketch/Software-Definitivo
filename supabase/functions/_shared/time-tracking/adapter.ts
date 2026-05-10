// ZConnect Time Tracking adapter — FASE 6
// Usa automaticamente la modalità demo se ZCONNECT_API_URL non è configurato.
// Env var per ZConnect reale:
//   ZCONNECT_API_URL    — es. https://api.zconnect.it
//   ZCONNECT_API_KEY    — chiave API ZConnect
//   ZCONNECT_STORE_ID   — ID del negozio nel sistema ZConnect

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type TimeTrackingEventType = "clock_in" | "clock_out" | "break_start" | "break_end";

export interface TimeTrackingEvent {
  employeeId: string;
  storeId: string;
  shiftId?: string;
  type: TimeTrackingEventType;
  timestamp?: string;   // ISO 8601; default: now()
  notes?: string;
}

export interface TimeTrackingResult {
  success: boolean;
  isDemo: boolean;
  eventId: string;
  timestamp: string;
  provider: "demo" | "zconnect";
}

// ─── Interfaccia provider (contratto per futura integrazione) ─────────────────

export interface ITimeTrackingProvider {
  readonly isDemo: boolean;
  record(event: TimeTrackingEvent): Promise<TimeTrackingResult>;
}

// ─── Demo provider — salva su time_tracking_demo_entries ─────────────────────

export class DemoTimeTrackingProvider implements ITimeTrackingProvider {
  readonly isDemo = true;

  constructor(private readonly adminClient: ReturnType<typeof createClient>) {}

  async record(event: TimeTrackingEvent): Promise<TimeTrackingResult> {
    const ts = event.timestamp ?? new Date().toISOString();

    const { data, error } = await this.adminClient
      .from("time_tracking_demo_entries")
      .insert({
        employee_id: event.employeeId,
        store_id:    event.storeId,
        shift_id:    event.shiftId ?? null,
        type:        event.type,
        timestamp:   ts,
        is_demo:     true,
        notes:       event.notes ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Demo time tracking insert failed: ${error.message}`);

    return {
      success:   true,
      isDemo:    true,
      eventId:   (data as { id: string }).id,
      timestamp: ts,
      provider:  "demo",
    };
  }
}

// ─── ZConnect provider — chiama l'API reale ───────────────────────────────────
// Adatta l'endpoint quando la documentazione ZConnect sarà disponibile.

export class ZConnectTimeTrackingProvider implements ITimeTrackingProvider {
  readonly isDemo = false;

  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly zconnectStoreId: string,
  ) {}

  async record(event: TimeTrackingEvent): Promise<TimeTrackingResult> {
    const ts = event.timestamp ?? new Date().toISOString();

    const res = await fetch(`${this.apiUrl}/api/v1/timekeeping/events`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Store-Id":   this.zconnectStoreId,
      },
      body: JSON.stringify({
        employee_external_id: event.employeeId,
        event_type:           event.type,
        timestamp:            ts,
        shift_id:             event.shiftId ?? null,
        notes:                event.notes   ?? null,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`ZConnect API error ${res.status}: ${txt}`);
    }

    const data = await res.json() as { id: string; timestamp?: string };
    return {
      success:   true,
      isDemo:    false,
      eventId:   data.id,
      timestamp: data.timestamp ?? ts,
      provider:  "zconnect",
    };
  }
}

// ─── Factory — auto-rileva provider ──────────────────────────────────────────

export function createTimeTrackingProvider(
  adminClient: ReturnType<typeof createClient>,
): ITimeTrackingProvider {
  const apiUrl  = Deno.env.get("ZCONNECT_API_URL");
  const apiKey  = Deno.env.get("ZCONNECT_API_KEY");
  const storeId = Deno.env.get("ZCONNECT_STORE_ID");

  if (apiUrl && apiKey && storeId) {
    console.log("[time-tracking] Using ZConnect real provider");
    return new ZConnectTimeTrackingProvider(apiUrl, apiKey, storeId);
  }

  console.log("[time-tracking] ZConnect not configured — using demo mode");
  return new DemoTimeTrackingProvider(adminClient);
}
