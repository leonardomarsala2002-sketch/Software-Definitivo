# Deployment

## Prerequisiti

- Node.js 18+
- Account Supabase con progetto attivo
- Account Vercel (o altro hosting statico)
- Supabase CLI installata: `npm install -g supabase`

---

## 1. Supabase — Database e Edge Functions

### 1.1 Applicare le migration

```bash
# Verifica le migration pending
npx supabase db diff --project-ref hzcnvfqbbzkqyvolokvt

# Applica le migration in produzione
npx supabase db push --project-ref hzcnvfqbbzkqyvolokvt
```

Le migration si trovano in `supabase/migrations/` ordinate per timestamp. Non modificare mai migration già applicate in produzione: crea sempre una nuova migration.

### 1.2 Deploy Edge Functions

```bash
# Deploy tutte le functions (prima volta o dopo modifiche)
npx supabase functions deploy --project-ref hzcnvfqbbzkqyvolokvt

# Deploy singola function
npx supabase functions deploy ai-assistant --project-ref hzcnvfqbbzkqyvolokvt
```

### 1.3 Configurare i segreti

Vai su **Supabase Dashboard → Project hzcnvfqbbzkqyvolokvt → Edge Functions → Secrets** e aggiungi:

**Obbligatori:**

| Nome | Dove ottenerlo |
|---|---|
| `LOVABLE_API_KEY` | Già presente — chiave Lovable AI Gateway |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `PUBLIC_APP_URL` | URL dell'app deployata (es. `https://turni.example.com`) |

**Opzionali:**

| Nome | Quando serve |
|---|---|
| `TWILIO_ACCOUNT_SID` | Se vuoi notifiche WhatsApp |
| `TWILIO_AUTH_TOKEN` | " |
| `TWILIO_FROM_NUMBER` | " |
| `GOOGLE_CALENDAR_ENABLED` | Se vuoi sync Google Calendar |
| `GOOGLE_CLIENT_ID` | " |
| `GOOGLE_CLIENT_SECRET` | " |
| `GOOGLE_REFRESH_TOKEN` | " |
| `ZCONNECT_API_URL` | Se vuoi ZConnect reale (senza = demo mode) |
| `ZCONNECT_API_KEY` | " |
| `ZCONNECT_STORE_ID` | " |

### 1.4 Verificare RLS e Storage

```bash
# Controlla che RLS sia abilitato sulle tabelle principali
npx supabase db inspect --project-ref hzcnvfqbbzkqyvolokvt
```

Verifica nel Supabase Dashboard → Storage che il bucket `illness-certificates` esista e sia **privato** (non pubblico).

---

## 2. Frontend — Build e Deploy su Vercel

### 2.1 Variabili d'ambiente Vercel

Nella dashboard Vercel → Settings → Environment Variables, aggiungi:

```
VITE_SUPABASE_URL      = https://hzcnvfqbbzkqyvolokvt.supabase.co
VITE_SUPABASE_ANON_KEY = <anon key>
```

La anon key si trova in Supabase Dashboard → Settings → API → Project API keys → `anon public`.

### 2.2 Build settings Vercel

```
Build Command:  npm run build
Output Dir:     dist
Install Command: npm install
```

### 2.3 Deploy

```bash
# Prima volta: connetti repository
vercel --prod

# Deploy aggiornamento
git push origin main   # auto-deploy se Vercel è connesso al repo
```

### 2.4 Domain

1. Vercel Dashboard → Domains → Add Domain
2. Configura DNS nel tuo provider (record CNAME o A)
3. Aggiorna `PUBLIC_APP_URL` nei segreti Supabase con il nuovo dominio

---

## 3. Cron Job — Generazione automatica turni

Il cron job genera automaticamente i turni ogni giovedì alle 06:00 UTC.

```bash
# Verifica che il cron sia configurato in Supabase
# Dashboard → Edge Functions → cron-generate-shifts → Schedules
```

Schedule: `0 6 * * 4` (ogni giovedì alle 06:00 UTC)

Se non è configurato:
1. Supabase Dashboard → Edge Functions → `cron-generate-shifts`
2. Aggiungi schedule: `0 6 * * 4`

---

## 4. Checklist pre go-live

### Database
- [ ] Tutte le migration applicate (`npx supabase db push`)
- [ ] RLS abilitato su tutte le tabelle principali
- [ ] Bucket `illness-certificates` privato e esistente
- [ ] Nessun dato di test in produzione

### Edge Functions
- [ ] Tutte le functions deployate
- [ ] Segreti obbligatori configurati (`LOVABLE_API_KEY`, `RESEND_API_KEY`, `PUBLIC_APP_URL`)
- [ ] Cron job configurato (`0 6 * * 4`)
- [ ] Test manuale chiamata `generate-optimized-schedule`

### Frontend
- [ ] Build produzione senza errori TypeScript (`npm run build`)
- [ ] Variabili Vite configurate in Vercel
- [ ] PWA manifest raggiungibile a `/manifest.json`
- [ ] Service worker registrato (apri DevTools → Application → Service Workers)
- [ ] App installabile su Chrome desktop

### Sicurezza
- [ ] Nessuna chiave API nel codice frontend (grep: `sk-`, `SUPABASE_SERVICE_ROLE`)
- [ ] CORS correttamente configurato in ogni Edge Function
- [ ] Rate limiting attivo per login e AI calls
- [ ] Audit log funzionante (esegui un'azione sensibile e verifica in `/audit-log`)

### Funzionalità
- [ ] Login email + OTP funzionante
- [ ] Creazione store e invito dipendente end-to-end
- [ ] Generazione turni con AI funzionante
- [ ] Pubblicazione turni e notifica email ricevuta
- [ ] Richiesta ferie da dipendente + approvazione manager
- [ ] Upload certificato malattia

---

## 5. Rollback

```bash
# Rollback Edge Function a versione precedente
# (via Supabase Dashboard → Functions → Deployments → seleziona versione)

# Rollback frontend
# Vercel Dashboard → Deployments → seleziona deployment → Redeploy

# Rollback migration DB
# Non possibile automaticamente — preparare migration di rollback manuali
# Prima di applicare migration distruttive, fare backup:
npx supabase db dump --project-ref hzcnvfqbbzkqyvolokvt > backup_$(date +%Y%m%d).sql
```

---

## 6. Monitoring

- **Edge Function logs**: Supabase Dashboard → Edge Functions → Logs
- **DB errors**: Supabase Dashboard → Database → Logs
- **Frontend errors**: Vercel Dashboard → Deployments → Functions → Logs
- **Quality score turni**: Dashboard admin → QualityScoreCard (aggiornata ad ogni generazione)
- **Audit log**: `/audit-log` (visibile solo a super_admin)
