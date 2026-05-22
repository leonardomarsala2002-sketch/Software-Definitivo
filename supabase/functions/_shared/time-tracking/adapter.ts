// ZConnect Time Tracking adapter — FASE 6
// Usa automaticamente la modalità demo se ZCONNECT_API_URL non è configurato.
// Env var per ZConnect reale:
//   ZCONNECT_API_URL    — es. https://api.zconnect.it
//   ZCONNECT_API_KEY    — chiave API ZConnect
//   ZCONNECT_STORE_ID   — ID del negozio nel sistema ZConnect
//
// NOTA: l'endpoint /api/v1/timekeeping/events è un placeholder — adattare
// quando la documentazione ZConnect ufficiale sarà disponibile.
// Il payload atteso è:
//   { employee_external_id, event_type, timestamp, shift_id?, notes? }
// La risposta attesa è:
//   { id: string, timestamp?: string }

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

const ZCONNECT_TIMEOUT_MS = 10_000;
const ZCONNECT_MAX_RETRIES = 2;

async function fetchWithTimeoutAndRetry(
  url: string,
  init: RequestInit,
  retries = ZCONNECT_MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ZCONNECT_TIMEOUT_MS);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      // Retry only on 5xx server errors or 429 rate-limit
      if ((res.status >= 500 || res.status === 429) && attempt < retries) {
        const retryAfterMs = res.status === 429
          ? (parseInt(res.headers.get("retry-after") ?? "2", 10) * 1000)
          : (2 ** attempt) * 500;
        console.warn(`[ZConnect] HTTP ${res.status} — retry ${attempt + 1}/${retries} in ${retryAfterMs}ms`);
        await new Promise((r) => setTimeout(r, retryAfterMs));
        continue;
      }

      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      const isTimeout = lastError.name === "AbortError";
      if (attempt < retries) {
        const delay = (2 ** attempt) * 500;
        console.warn(`[ZConnect] ${isTimeout ? "Timeout" : "Network error"} — retry ${attempt + 1}/${retries} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("ZConnect: richiesta fallita dopo tutti i tentativi");
}

export class ZConnectTimeTrackingProvider implements ITimeTrackingProvider {
  readonly isDemo = false;

  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly zconnectStoreId: string,
  ) {}

  async record(event: TimeTrackingEvent): Promise<TimeTrackingResult> {
    const ts = event.timestamp ?? new Date().toISOString();

    let res: Response;
    try {
      res = await fetchWithTimeoutAndRetry(
        `${this.apiUrl}/api/v1/timekeeping/events`,
        {
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
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `ZConnect non raggiungibile: ${msg}. ` +
        `Verifica che ZCONNECT_API_URL (${this.apiUrl}) sia corretto e che il servizio sia attivo.`,
      );
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const hint =
        res.status === 401
          ? " — controlla ZCONNECT_API_KEY"
          : res.status === 403
          ? " — controlla i permessi del token ZConnect"
          : res.status === 404
          ? " — endpoint non trovato, aggiornare quando arriva la doc ZConnect"
          : res.status === 422
          ? " — payload non valido, verifica il formato employee_external_id"
          : "";
      throw new Error(`ZConnect API error ${res.status}${hint}: ${txt}`);
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
