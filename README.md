# Gestionale Turni Multi-Store

Sistema di gestione turni per catene retail multi-store con generazione AI, regole hard/soft configurabili, notifiche multi-canale e PWA installabile.

## Stack

| Layer | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| State management | @tanstack/react-query |
| Routing | react-router-dom v6 |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL (Supabase) con RLS |
| AI | Google Gemini 2.5 Flash via Lovable AI Gateway |
| Email | Resend |
| WhatsApp | Twilio Programmable Messaging |
| Auth | Supabase Auth (email + OTP) |

## Avvio in development

```bash
# Installa dipendenze
npm install

# Avvia dev server
npm run dev

# Avvia test suite
npm test

# Lancia test con coverage
npm run test:coverage
```

Il dev server gira su `http://localhost:5173`.

## Variabili d'ambiente

### Frontend (Vite) — file `.env.local`

```env
VITE_SUPABASE_URL=https://hzcnvfqbbzkqyvolokvt.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key da Supabase Dashboard>
```

### Supabase Edge Functions — Secrets nella Dashboard

**Obbligatori:**

| Nome | Descrizione |
|---|---|
| `LOVABLE_API_KEY` | Chiave Lovable AI Gateway (per generazione turni e AI Assistant) |
| `RESEND_API_KEY` | Chiave Resend per notifiche email |
| `PUBLIC_APP_URL` | URL pubblico dell'app (es. `https://turni.example.com`) |

**Opzionali (integrazioni future):**

| Nome | Descrizione |
|---|---|
| `TWILIO_ACCOUNT_SID` | Account SID Twilio per WhatsApp |
| `TWILIO_AUTH_TOKEN` | Auth token Twilio |
| `TWILIO_FROM_NUMBER` | Numero mittente WhatsApp (formato `+39...`) |
| `GOOGLE_CALENDAR_ENABLED` | `"true"` per abilitare Google Calendar |
| `GOOGLE_CLIENT_ID` | OAuth2 Client ID Google |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Client Secret Google |
| `GOOGLE_REFRESH_TOKEN` | Refresh token OAuth2 (ottenuto one-time) |
| `GOOGLE_CALENDAR_ID` | ID calendario (default: `"primary"`) |
| `ZCONNECT_API_URL` | URL base API ZConnect |
| `ZCONNECT_API_KEY` | Chiave API ZConnect |
| `ZCONNECT_STORE_ID` | ID negozio in ZConnect |
| `AI_PROVIDER` | Forza provider AI: `"lovable"`, `"anthropic"`, `"openai"` |
| `ANTHROPIC_API_KEY` | Chiave Anthropic (se non si usa Lovable Gateway) |
| `OPENAI_API_KEY` | Chiave OpenAI (se non si usa Lovable Gateway) |

## Comandi principali

```bash
npm run dev          # Dev server con hot reload
npm run build        # Build produzione
npm run preview      # Anteprima build produzione
npm test             # Test suite Vitest
npm run lint         # ESLint
npm run typecheck    # TypeScript type check
```

### Edge Functions (Supabase CLI)

```bash
# Deploy singola function
npx supabase functions deploy <nome-function> --project-ref hzcnvfqbbzkqyvolokvt

# Deploy tutte le functions
npx supabase functions deploy --project-ref hzcnvfqbbzkqyvolokvt

# Esegui migration DB
npx supabase db push --project-ref hzcnvfqbbzkqyvolokvt
```

## Struttura del progetto

```
src/
  components/          # Componenti React (dashboard, calendario, richieste, dipendenti)
  contexts/            # AuthContext, ThemeContext
  pages/               # Route-level components
  config/              # navigation.ts
  integrations/        # Supabase client e types generati
  lib/                 # scheduling-engine (TypeScript puro)
  test/                # Test suite Vitest

supabase/
  functions/           # Edge Functions Deno
    _shared/           # Moduli condivisi (auth, notify, rule engine, AI, adapters)
  migrations/          # Migration SQL ordinate per timestamp

public/
  manifest.json        # PWA manifest
  sw.js                # Service Worker
  icons/               # Icone PWA (SVG)

docs/                  # Documentazione tecnica
```

## Ruoli utente

| Ruolo | Accesso |
|---|---|
| `super_admin` | Tutto — admin globale, audit log, tutti gli store |
| `admin` | Tutti gli store — gestione completa |
| `store_manager` | Solo store assegnati — gestione turni, dipendenti |
| `employee` | Solo proprio profilo — visualizza turni, invia richieste |

## Documentazione tecnica

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Architettura del sistema
- [docs/RULE_ENGINE.md](docs/RULE_ENGINE.md) — Rule engine e quality score
- [docs/ROLES_AND_PERMISSIONS.md](docs/ROLES_AND_PERMISSIONS.md) — RBAC e permessi
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — Google Calendar, ZConnect, WhatsApp
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Deploy su Vercel + Supabase, checklist go-live
