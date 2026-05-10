// Google Calendar OAuth2 adapter — FASE 6
// Feature-flagged: skip silenzioso se GOOGLE_CALENDAR_ENABLED != "true"
// Env var richieste (quando abilitato):
//   GOOGLE_CALENDAR_ENABLED=true
//   GOOGLE_CLIENT_ID       — OAuth2 client ID da Google Cloud Console
//   GOOGLE_CLIENT_SECRET   — OAuth2 client secret
//   GOOGLE_REFRESH_TOKEN   — token ottenuto dal flusso OAuth2 one-time
//   GOOGLE_CALENDAR_ID     — (opzionale) default "primary"

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  start: string;          // ISO 8601 con timezone
  end: string;
  timeZone?: string;      // default: "Europe/Rome"
  attendees?: string[];   // email addresses
}

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
}

export function isGoogleCalendarEnabled(): boolean {
  return (
    Deno.env.get("GOOGLE_CALENDAR_ENABLED") === "true" &&
    !!Deno.env.get("GOOGLE_CLIENT_ID") &&
    !!Deno.env.get("GOOGLE_CLIENT_SECRET") &&
    !!Deno.env.get("GOOGLE_REFRESH_TOKEN")
  );
}

export function getGoogleCalendarConfig(): GoogleCalendarConfig | null {
  if (!isGoogleCalendarEnabled()) return null;
  return {
    clientId:     Deno.env.get("GOOGLE_CLIENT_ID")!,
    clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
    refreshToken: Deno.env.get("GOOGLE_REFRESH_TOKEN")!,
    calendarId:   Deno.env.get("GOOGLE_CALENDAR_ID") ?? "primary",
  };
}

async function getAccessToken(config: GoogleCalendarConfig): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type:    "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Google OAuth token refresh failed ${res.status}: ${txt}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/** Crea un evento su Google Calendar. Ritorna il google_event_id. */
export async function createCalendarEvent(
  config: GoogleCalendarConfig,
  event: CalendarEvent,
): Promise<string> {
  const token = await getAccessToken(config);
  const calId = encodeURIComponent(config.calendarId);

  const body = {
    summary:     event.title,
    description: event.description ?? "",
    start: { dateTime: event.start, timeZone: event.timeZone ?? "Europe/Rome" },
    end:   { dateTime: event.end,   timeZone: event.timeZone ?? "Europe/Rome" },
    attendees: (event.attendees ?? []).map(email => ({ email })),
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Google Calendar createEvent error ${res.status}: ${txt}`);
  }
  const data = await res.json() as { id: string };
  return data.id;
}

/** Aggiorna parzialmente un evento esistente (PATCH). */
export async function updateCalendarEvent(
  config: GoogleCalendarConfig,
  googleEventId: string,
  event: Partial<CalendarEvent>,
): Promise<void> {
  const token   = await getAccessToken(config);
  const calId   = encodeURIComponent(config.calendarId);
  const eventId = encodeURIComponent(googleEventId);

  const body: Record<string, unknown> = {};
  if (event.title)                    body.summary     = event.title;
  if (event.description !== undefined) body.description = event.description;
  if (event.start) body.start = { dateTime: event.start, timeZone: event.timeZone ?? "Europe/Rome" };
  if (event.end)   body.end   = { dateTime: event.end,   timeZone: event.timeZone ?? "Europe/Rome" };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Google Calendar updateEvent error ${res.status}: ${txt}`);
  }
}

/** Elimina un evento. 404 è tollerato (già eliminato). */
export async function deleteCalendarEvent(
  config: GoogleCalendarConfig,
  googleEventId: string,
): Promise<void> {
  const token   = await getAccessToken(config);
  const calId   = encodeURIComponent(config.calendarId);
  const eventId = encodeURIComponent(googleEventId);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Google Calendar deleteEvent error ${res.status}: ${txt}`);
  }
}
