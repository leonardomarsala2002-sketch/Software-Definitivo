# Ruoli e Permessi

## Ruoli disponibili

Il sistema usa un enum PostgreSQL `app_role` con 4 valori:

| Ruolo | Descrizione |
|---|---|
| `super_admin` | Amministratore globale. Può fare tutto, vedere tutti gli store, audit log completo |
| `admin` | Amministratore multi-store. Gestisce tutti i negozi e i dipendenti |
| `store_manager` | Responsabile di uno o più store assegnati. Gestisce turni e richieste del suo store |
| `employee` | Dipendente. Vede solo i propri turni e invia richieste |

Il ruolo è salvato in `profiles.app_role` e caricato ad ogni autenticazione.

## Matrice permessi

| Azione | super_admin | admin | store_manager | employee |
|---|:---:|:---:|:---:|:---:|
| Vedere tutti gli store | ✓ | ✓ | solo assegnati | solo assegnati |
| Generare turni | ✓ | ✓ | ✓ | ✗ |
| Pubblicare turni | ✓ | ✓ | ✓ | ✗ |
| Approvare richieste | ✓ | ✓ | ✓ | ✗ |
| Invitare dipendenti | ✓ | ✓ | ✓ | ✗ |
| Reset password dipendenti | ✓ | ✓ | ✓ | ✗ |
| Vedere dipendenti | ✓ | ✓ | ✓ | ✗ |
| AI Assistant | ✓ | ✓ | ✓ | ✗ |
| Audit Log | ✓ | ✗ | ✗ | ✗ |
| Manage Stores (multi-store) | ✓ | ✗ | ✗ | ✗ |
| Inviare richieste | ✓ | ✓ | ✓ | ✓ |
| Vedere propri turni | ✓ | ✓ | ✓ | ✓ |
| Caricare certificato malattia | ✓ | ✓ | ✓ | ✓ |
| Modificare proprie preferenze | ✓ | ✓ | ✓ | ✓ |

## RBAC nel codice

### Frontend — navigazione

Il file `src/config/navigation.ts` definisce i `navItems` con il campo `roles?: AppRole[]`:

```typescript
{ title: "Dipendenti", url: "/employees", roles: ["super_admin", "admin", "store_manager"] }
```

La funzione `filterNavByRole(items, role)` filtra gli item visibili nella sidebar. Le route React non hanno protezione lato client oltre alla navigazione: la sicurezza reale è nel backend.

### Frontend — ProtectedRoute

`src/components/ProtectedRoute.tsx` protegge tutte le route autenticate. Se l'utente non è loggato, redirige a `/login`.

### Backend — Edge Functions

Ogni Edge Function chiama `requireAuth(req)` all'inizio:

```typescript
const authResult = await requireAuth(req);
if (authResult instanceof Response) return authResult; // 401 se non autenticato
const { userId, role, adminClient } = authResult;
```

`requireAuth` verifica il JWT Bearer token, carica `profiles.app_role` e `user_store_assignments`, e restituisce `userId`, `role` e un `adminClient` con service role per operazioni DB.

Per verificare l'accesso a uno store specifico:

```typescript
const hasAccess = await hasStoreAccess(adminClient, userId, storeId, role);
if (!hasAccess) return json({ error: "Accesso non autorizzato" }, 403);
```

`hasStoreAccess` ritorna `true` per `super_admin` e `admin` sempre; per `store_manager` ed `employee` verifica `user_store_assignments`.

### Database — Row Level Security

RLS è abilitato su tutte le tabelle principali. Le policy seguono questo pattern:

```sql
-- Dipendente vede solo i propri dati
CREATE POLICY "employee_own_data"
  ON shifts FOR SELECT
  USING (user_id = auth.uid());

-- Manager vede dati del suo store
CREATE POLICY "manager_store_data"
  ON shifts FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM user_store_assignments WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND app_role IN ('admin', 'super_admin')
    )
  );

-- Service role bypassa tutto (usato dalle Edge Functions)
CREATE POLICY "service_role_full_access"
  ON shifts FOR ALL
  USING (auth.role() = 'service_role');
```

## Rate limiting

Il rate limiting è implementato in `_shared/auth.ts` tramite `checkRateLimit()`. Usa la tabella `rate_limit_log` con chiave (key, window). Limiti configurati:

| Endpoint | Limite | Finestra |
|---|---|---|
| Login / OTP | 5 tentativi | 60 secondi |
| AI Assistant | 5 chiamate | 60 secondi per utente |
| generate-optimized-schedule | 2 chiamate | 60 secondi per store |

## Audit Log

Le azioni sensibili sono tracciate in `audit_log` tramite `writeAuditLog()`:

```typescript
await writeAuditLog(adminClient, {
  userId, role, storeId,
  action: "publish_shifts",
  entityType: "schedule",
  details: { weekStart, shiftsCount },
  req, // IP, user-agent estratti automaticamente
});
```

Solo `super_admin` può visualizzare l'audit log dall'interfaccia (`/audit-log`).

## Cambio ruolo

Il ruolo è modificabile solo da `super_admin` o `admin` via Supabase Dashboard o Edge Function dedicata. Non esiste UI per il cambio ruolo in produzione — è un'operazione di amministrazione del sistema.
