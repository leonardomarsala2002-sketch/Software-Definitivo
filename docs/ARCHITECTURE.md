# Architettura del sistema

## Panoramica

Il sistema è un'applicazione SPA React con backend Supabase (PostgreSQL + Edge Functions Deno). Non esistono server tradizionali: tutto il backend è composto da Edge Functions stateless deployate su Deno Deploy.

```
Browser (React SPA / PWA)
        │
        ├──► Supabase Auth   (JWT, OTP, OAuth)
        ├──► Supabase DB     (PostgreSQL, RLS)
        ├──► Supabase Storage (certificati malattia, privato)
        └──► Supabase Edge Functions (Deno)
                    │
                    ├──► Lovable AI Gateway → Gemini 2.5 Flash
                    ├──► Resend (email)
                    ├──► Twilio (WhatsApp, opzionale)
                    ├──► Google Calendar API (opzionale)
                    └──► ZConnect API (opzionale, fallback demo)
```

## Moduli principali

### Frontend

| Modulo | Percorso | Descrizione |
|---|---|---|
| AppShell | `src/components/AppShell.tsx` | Layout principale con sidebar |
| AppSidebar | `src/components/AppSidebar.tsx` | Navigazione laterale filtrata per ruolo |
| Dashboard | `src/pages/Dashboard.tsx` | Dashboard differenziata per ruolo |
| TeamCalendar | `src/pages/TeamCalendar.tsx` | Calendario turni con drag-drop e filtri |
| Requests | `src/pages/Requests.tsx` | Gestione richieste dipendente |
| Employees | `src/pages/Employees.tsx` | Anagrafica dipendenti |
| AIAssistant | `src/pages/AIAssistant.tsx` | Interfaccia AI con 7 feature |
| AuthContext | `src/contexts/AuthContext.tsx` | Stato autenticazione globale |

### Backend — Edge Functions

| Function | Trigger | Descrizione |
|---|---|---|
| `generate-optimized-schedule` | Manuale / Cron giovedì | Genera turni via AI + rule engine |
| `publish-shifts` | Manuale | Pubblica turni, notifica dipendenti |
| `approve-patch-shifts` | Manuale | Modifica/approva turni esistenti |
| `cron-generate-shifts` | Cron job (giovedì) | Wrapper cron per generazione automatica |
| `manage-time-off` | Dipendente | Crea richieste ferie/permesso |
| `manage-illness-certificate` | Dipendente | Invia certificato malattia |
| `get-leave-balance` | Frontend | Restituisce saldi ferie/permessi |
| `employee-onboarding` | Frontend | Salva preferenze turni dipendente |
| `ai-assistant` | Frontend | Chatbot AI con 7 modalità |
| `sync-calendar` | Manuale | Sincronizza turni su Google Calendar |
| `time-tracking` | Frontend | Registra timbrature (ZConnect / demo) |
| `send-invite-email` | Admin | Invia email invito dipendente |
| `admin-reset-password` | Admin | Reset password forzato |
| `create-lending-request` | Store manager | Richiesta prestito dipendente inter-store |
| `patch-lending-request-status` | Store manager | Approva/rifiuta prestito |
| `send-lending-message` | Store manager | Messaggi tra store per prestiti |

### Backend — Moduli condivisi (`_shared/`)

| Modulo | Descrizione |
|---|---|
| `auth.ts` | `requireAuth()`, `hasStoreAccess()`, `checkRateLimit()`, `writeAuditLog()` |
| `notify.ts` | `sendNotification()` multi-canale (in-app, email, WhatsApp) |
| `notification-templates.ts` | Template messaggi per ogni tipo di notifica |
| `scheduling-engine/` | Rule engine TypeScript puro: hard rules, soft rules, validator, quality score |
| `ai-assistant/` | Provider AI (Lovable/Anthropic/OpenAI), context builder, bridge, 7 feature |
| `google-calendar/adapter.ts` | OAuth2 + CRUD eventi Google Calendar |
| `time-tracking/adapter.ts` | ZConnect adapter + demo mode |

## Flusso dati — Generazione turni

```
1. Trigger (cron giovedì o manuale da TeamCalendar)
2. generate-optimized-schedule:
   a. Carica dati DB: dipendenti, contratti, regole store, copertura richiesta,
      ferie approvate, preferenze, storico turni 4 settimane
   b. Pre-pianifica giorni liberi (obbligatori e preferiti)
   c. Genera 40 strategie via Lovable AI Gateway (Gemini 2.5 Flash)
   d. Per ogni strategia → rule engine: hard validation + quality score
   e. Seleziona strategia con score massimo
   f. Salva turni in `shifts` (status=draft)
3. Admin/manager revisiona in TeamCalendar
4. publish-shifts:
   a. Ri-valida turni via rule engine
   b. Se violazioni hard → blocca
   c. Pubblica (status=published)
   d. Notifica dipendenti (in-app + email + WhatsApp opzionale)
```

## Flusso dati — Richiesta dipendente

```
1. Dipendente invia richiesta via RequestForm
2. manage-time-off Edge Function:
   a. Verifica saldo ferie
   b. Controlla deadline (4 giorni prima della settimana)
   c. Crea record in time_off_requests (status=pending)
   d. Notifica manager
3. Manager approva/rifiuta in Requests page
4. Se approvata: future generazioni escluderanno quel giorno per quel dipendente
```

## Database — Tabelle principali

| Tabella | Descrizione |
|---|---|
| `profiles` | Profilo utente + app_role |
| `stores` | Anagrafica negozi |
| `user_store_assignments` | Mapping dipendente ↔ store |
| `employee_details` | Dettagli lavorativi (dipartimento, ore contratto) |
| `employee_preferences` | Preferenze turni (tipo, giorni liberi, weekend) |
| `employee_leave_balances` | Saldi ferie/permessi per anno |
| `shifts` | Turni generati (draft/published) |
| `time_off_requests` | Richieste ferie/permessi/malattia |
| `illness_certificates` | Certificati malattia con storage path |
| `store_rules` | Regole orario store (min/max ore, riposi) |
| `store_coverage_requirements` | Copertura minima per slot orario |
| `store_opening_hours` | Orari apertura/chiusura |
| `generation_runs` | Log generazioni AI (score, violazioni) |
| `notifications` | Notifiche in-app multi-canale |
| `audit_log` | Audit trail azioni sensibili |
| `calendar_appointments` | Appuntamenti Google Calendar sincronizzati |
| `time_tracking_demo_entries` | Timbrature demo / ZConnect |

## Sicurezza

- **RLS** abilitato su tutte le tabelle principali
- **JWT** Supabase per ogni richiesta autenticata
- **Service role key** usata solo nelle Edge Functions (mai esposta al frontend)
- **Rate limiting** su login, OTP e chiamate AI (tabella `rate_limit_log`)
- **Audit log** per azioni: pubblicazione turni, approvazioni, reset password, chiamate AI
- **CORS** configurato in ogni Edge Function (`Access-Control-Allow-Origin: *`)
- **Upload file** su bucket privato (`illness-certificates`) — URL firmati con scadenza 1 anno
- Nessuna chiave API nel codice frontend

## PWA

- `public/manifest.json`: `display: standalone`, icone SVG 192px e 512px
- `public/sw.js`: network-first per navigazione, cache-first per asset statici (.js, .css, .svg, .woff2)
- Installabile su Chrome desktop, Chrome Android, Safari iOS
- Il service worker non intercetta chiamate Supabase (`/rest/`, `/auth/`, `/storage/`)
