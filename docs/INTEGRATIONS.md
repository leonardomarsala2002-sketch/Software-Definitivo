# Integrazioni

Tutte le integrazioni sono **opzionali e feature-flaggate**. Il sistema funziona in modo completo anche senza di esse. Se le variabili d'ambiente non sono configurate, le integrazioni vengono saltate silenziosamente (nessun errore mostrato all'utente).

---

## WhatsApp (Twilio)

### Stato: predisposto e funzionante

L'adapter WhatsApp è implementato in `supabase/functions/_shared/notify.ts`. È attivato automaticamente quando le credenziali Twilio sono presenti.

### Configurazione

1. Crea un account [Twilio](https://twilio.com)
2. Abilita il canale **WhatsApp Sandbox** (test) o acquista un numero WhatsApp Business
3. Aggiungi i seguenti segreti in Supabase Dashboard → Edge Functions → Secrets:

```
TWILIO_ACCOUNT_SID   = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN    = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER   = +39021234567  (numero mittente approvato da Twilio)
```

### Come funziona

```typescript
// notify.ts — skip automatico se credenziali mancanti
if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFromNumber) return;

// Messaggio formato:
// *Titolo notifica*
//
// Corpo del messaggio
```

### Template messaggi

I template sono centralizzati in `_shared/notification-templates.ts`:

| Tipo | Titolo | Corpo |
|---|---|---|
| `shift_published` | Turni pubblicati per la settimana del {week} | I turni della settimana del {week} sono stati pubblicati... |
| `shift_modified` | Turno modificato — {date} | Il tuo turno del {date} è stato modificato: {start_time}–{end_time} |
| `time_off_approved` | Richiesta approvata — {date} | La tua richiesta di {type} per il {date} è stata approvata |
| `time_off_rejected` | Richiesta non approvata — {date} | La tua richiesta di {type} per il {date} non è stata approvata |
| `illness_submitted` | Malattia comunicata — {employee} | {employee} ha comunicato malattia dal {start_date} al {end_date} |

Per personalizzare un template, modifica `TEMPLATES` in `notification-templates.ts`. I parametri tra `{...}` vengono sostituiti a runtime.

### Aggiungere WhatsApp a una nuova notifica

```typescript
import { sendNotification, getTemplate } from "../_shared/notify.ts";
import { getTemplate } from "../_shared/notification-templates.ts";

const { title, body } = getTemplate("shift_published", { week: "19 maggio 2026" });

await sendNotification(
  adminClient,
  { userId, storeId, type: "shift_published", title, body },
  ["in-app", "email", "whatsapp"],
  {
    resendApiKey:     Deno.env.get("RESEND_API_KEY"),
    twilioAccountSid: Deno.env.get("TWILIO_ACCOUNT_SID"),
    twilioAuthToken:  Deno.env.get("TWILIO_AUTH_TOKEN"),
    twilioFromNumber: Deno.env.get("TWILIO_FROM_NUMBER"),
  },
  { email: userEmail, phone: userPhone },
);
```

---

## Google Calendar

### Stato: predisposto (FASE 6)

L'adapter è in `supabase/functions/_shared/google-calendar/adapter.ts`. La Edge Function `sync-calendar` gestisce create/update/delete di eventi.

### Configurazione

#### Step 1 — Google Cloud Console

1. Vai su [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un nuovo progetto (o usa uno esistente)
3. Abilita **Google Calendar API**
4. Vai su **Credenziali** → **Crea credenziali** → **ID client OAuth 2.0**
5. Tipo applicazione: **Applicazione web**
6. URI di reindirizzamento autorizzati: `https://developers.google.com/oauthplayground`
7. Copia `Client ID` e `Client Secret`

#### Step 2 — Ottieni il Refresh Token (una tantum)

1. Vai su [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Clicca l'icona ⚙️ → Abilita "Use your own OAuth credentials" → inserisci Client ID e Secret
3. In "Select & authorize APIs" cerca `https://www.googleapis.com/auth/calendar`
4. Clicca "Authorize APIs" → accedi con l'account Google che possiede il calendario
5. Clicca "Exchange authorization code for tokens"
6. Copia il `Refresh token`

#### Step 3 — Configura i segreti Supabase

```
GOOGLE_CALENDAR_ENABLED = true
GOOGLE_CLIENT_ID        = 123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET    = GOCSPX-xxxxxxxxxxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN    = 1//0gxxxxxxxxxxxxxxxx
GOOGLE_CALENDAR_ID      = primary   (o ID del calendario specifico)
```

### Come usare sync-calendar

```bash
# Crea evento per un turno
curl -X POST https://<project>.supabase.co/functions/v1/sync-calendar \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "store_id": "<store-uuid>",
    "user_id": "<employee-uuid>",
    "shift_id": "<shift-uuid>",
    "shift": {
      "date": "2026-06-02",
      "start_time": "09:00",
      "end_time": "17:00",
      "department": "cassa"
    }
  }'
```

La risposta include `appointmentId` (UUID in `calendar_appointments`) e `googleEventId`.

### Skip automatico

Se `GOOGLE_CALENDAR_ENABLED` non è `"true"`, la funzione risponde:
```json
{ "isSkipped": true, "reason": "Google Calendar non configurato" }
```
Il chiamante può ignorare questa risposta senza errori.

---

## ZConnect Time Tracking

### Stato: predisposto con demo mode (FASE 6)

L'adapter è in `supabase/functions/_shared/time-tracking/adapter.ts`. La Edge Function `time-tracking` accetta timbrature e usa ZConnect o demo in base alla configurazione.

### Demo mode (default)

Senza variabili ZConnect, il sistema salva le timbrature nella tabella `time_tracking_demo_entries` con `is_demo = true`. Funziona immediatamente senza configurazione.

### Configurazione ZConnect reale

```
ZCONNECT_API_URL   = https://api.zconnect.it
ZCONNECT_API_KEY   = <chiave API fornita da ZConnect>
ZCONNECT_STORE_ID  = <ID negozio in ZConnect>
```

Quando queste variabili sono presenti, la factory `createTimeTrackingProvider()` usa automaticamente `ZConnectTimeTrackingProvider` invece della demo.

### Contratto API ZConnect

Il provider invia a `POST {ZCONNECT_API_URL}/api/v1/timekeeping/events`:

```json
{
  "employee_external_id": "<uuid dipendente>",
  "event_type": "clock_in",
  "timestamp": "2026-06-02T09:03:42Z",
  "shift_id": "<uuid turno opzionale>",
  "notes": null
}
```

**Adattare** l'endpoint e il formato del body alla documentazione ZConnect reale quando disponibile. Il file da modificare è `_shared/time-tracking/adapter.ts`, metodo `ZConnectTimeTrackingProvider.record()`.

### Come registrare una timbratura

```bash
curl -X POST https://<project>.supabase.co/functions/v1/time-tracking \
  -H "Authorization: Bearer <jwt-dipendente>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "clock_in",
    "store_id": "<store-uuid>",
    "shift_id": "<shift-uuid>",
    "notes": "Entrata regolare"
  }'
```

Risposta:
```json
{
  "success": true,
  "eventId": "<uuid>",
  "timestamp": "2026-06-02T09:03:42.000Z",
  "provider": "demo",
  "isDemo": true
}
```

---

## AI Provider (Lovable Gateway / Anthropic / OpenAI)

Il sistema supporta 3 provider AI. La priorità è:
1. **`LOVABLE_API_KEY`** (default, incluso nel piano Lovable)
2. `ANTHROPIC_API_KEY` (se `AI_PROVIDER=anthropic`)
3. `OPENAI_API_KEY` (se `AI_PROVIDER=openai`)

Per forzare un provider specifico, imposta `AI_PROVIDER` (valori: `lovable`, `anthropic`, `openai`).

I modelli predefiniti:
- Lovable Gateway: `google/gemini-2.5-flash`
- Anthropic: `claude-opus-4-7`
- OpenAI: `gpt-4o`

Per cambiare modello: imposta `AI_MODEL` nei segreti Supabase.
