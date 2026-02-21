

# Piano Tecnico: Autenticazione e Autorizzazione Multi-Store

## 1. Modello dei Ruoli

Il sistema prevede un **ruolo globale** (non per store) salvato in una tabella dedicata `user_roles`, separata da `profiles`. I tre ruoli sono definiti come enum PostgreSQL:

- **super_admin** -- accesso completo a tutti gli store e configurazioni globali
- **admin** -- gestisce solo gli store a cui e' assegnato
- **employee** -- sola lettura sul proprio store, puo' creare richieste personali

L'appartenenza a uno o piu' store e' gestita dalla tabella `user_store_assignments`, che e' indipendente dal ruolo.

---

## 2. Schema Tabelle Auth/Autorizzazione

### 2.1 Enum `app_role`

```text
super_admin | admin | employee
```

### 2.2 Tabella `profiles`

Dati anagrafici dell'utente, creata automaticamente al primo login tramite trigger.

| Colonna       | Tipo      | Note                                    |
|---------------|-----------|-----------------------------------------|
| id            | uuid PK   | FK -> auth.users(id) ON DELETE CASCADE  |
| full_name     | text      | Estratto da Google profile              |
| avatar_url    | text      | Estratto da Google profile              |
| email         | text      | Estratto da Google profile              |
| created_at    | timestamptz | default now()                         |
| updated_at    | timestamptz | default now()                         |

Nessun campo `role` in questa tabella.

### 2.3 Tabella `user_roles`

Ruolo globale dell'utente. Tabella separata per sicurezza (previene privilege escalation).

| Colonna  | Tipo      | Note                                   |
|----------|-----------|----------------------------------------|
| id       | uuid PK   | default gen_random_uuid()              |
| user_id  | uuid      | FK -> auth.users(id) ON DELETE CASCADE, UNIQUE |
| role     | app_role  | NOT NULL                               |

Un utente ha esattamente un ruolo globale.

### 2.4 Tabella `user_store_assignments`

Associazione utente-store (molti a molti).

| Colonna    | Tipo      | Note                                  |
|------------|-----------|---------------------------------------|
| id         | uuid PK   | default gen_random_uuid()             |
| user_id    | uuid      | FK -> auth.users(id) ON DELETE CASCADE|
| store_id   | uuid      | FK -> stores(id) ON DELETE CASCADE    |
| is_primary | boolean   | default false                         |
| created_at | timestamptz | default now()                       |

Vincolo UNIQUE su (user_id, store_id).

### 2.5 Tabella `invitations`

Gestione inviti. Solo utenti autenticati con ruolo superiore possono invitare.

| Colonna       | Tipo        | Note                                 |
|---------------|-------------|--------------------------------------|
| id            | uuid PK     | default gen_random_uuid()            |
| email         | text        | NOT NULL, email invitato             |
| role          | app_role    | NOT NULL, ruolo assegnato            |
| store_id      | uuid        | FK -> stores(id), nullable per super_admin |
| invited_by    | uuid        | FK -> auth.users(id)                 |
| token         | text        | UNIQUE, per link invito              |
| status        | text        | 'pending' / 'accepted' / 'expired'  |
| expires_at    | timestamptz | default now() + interval '7 days'    |
| created_at    | timestamptz | default now()                        |

---

## 3. Collegamento profiles <-> auth.users

- `profiles.id` e' una FK diretta a `auth.users(id)` con ON DELETE CASCADE
- Un **trigger** `on_auth_user_created` (AFTER INSERT su `auth.users`) crea automaticamente la riga in `profiles` estraendo `full_name`, `avatar_url`, `email` dai metadati Google
- Il trigger **non** crea un ruolo: il ruolo viene assegnato solo quando l'utente accetta un invito

---

## 4. Flusso Inviti (Solo su Invito)

```text
1. Admin/Super Admin crea invito -> riga in `invitations` con token univoco
2. Email inviata all'invitato (tramite Edge Function + Supabase Email)
3. Invitato clicca link -> pagina /invite?token=xxx
4. Invitato fa login con Google OAuth
5. Dopo login, Edge Function o trigger verifica:
   a. Esiste un invito pending per quell'email?
   b. Se si: crea user_roles + user_store_assignments, invito -> 'accepted'
   c. Se no: accesso negato, sessione terminata
```

### Regola gerarchia inviti

| Chi invita    | Puo' assegnare         |
|---------------|------------------------|
| super_admin   | admin, employee        |
| admin         | employee (solo nei propri store) |
| employee      | nessuno                |

Questa validazione avviene server-side (Edge Function o trigger di validazione).

---

## 5. Funzione Helper `has_role` (Security Definer)

Funzione PostgreSQL `SECURITY DEFINER` che verifica il ruolo senza causare ricorsione RLS:

```text
has_role(user_id, role) -> boolean
```

Usata in tutte le policy RLS al posto di query dirette su `user_roles`.

Funzione aggiuntiva:

```text
get_user_role(user_id) -> app_role
```

Per recuperare il ruolo corrente dell'utente (usata nel frontend via RPC).

---

## 6. Funzione Helper `is_store_member`

```text
is_store_member(user_id, store_id) -> boolean
```

Security definer che verifica l'appartenenza a uno store. Usata nelle RLS policy di tutte le tabelle con `store_id`.

---

## 7. Linee Guida RLS

Ogni tabella con `store_id` seguira' questo pattern:

- **super_admin**: accesso completo (SELECT/INSERT/UPDATE/DELETE)
- **admin**: accesso solo dove `is_store_member(auth.uid(), store_id)` e' true
- **employee**: SELECT solo dove `is_store_member(auth.uid(), store_id)` e' true; INSERT/UPDATE solo su tabelle specifiche (es. time_off_requests) dove `user_id = auth.uid()`

La tabella `user_roles` avra' RLS:
- SELECT: ogni utente puo' leggere il proprio ruolo; super_admin puo' leggere tutti
- INSERT/UPDATE/DELETE: solo via funzioni server-side (service_role key)

La tabella `profiles` avra' RLS:
- SELECT: utenti autenticati possono leggere profili dei colleghi nello stesso store
- UPDATE: solo il proprio profilo

---

## 8. Protezione Route Frontend

### AuthProvider (React Context)

- Wrappa l'intera app
- Ascolta `onAuthStateChange` per stato sessione
- Carica ruolo utente e store assegnati
- Espone: `user`, `role`, `stores`, `activeStore`, `isLoading`

### Route Guard

- Componente `ProtectedRoute` che verifica autenticazione
- Se non autenticato: redirect a `/login`
- Se autenticato ma senza ruolo (invito non accettato): schermata "Accesso non autorizzato"

### Visibilita' condizionale

| Route              | super_admin | admin | employee |
|--------------------|-------------|-------|----------|
| Dashboard          | si          | si    | si       |
| Calendario Team    | si          | si    | si (read)|
| Calendario Pers.   | si          | si    | si       |
| Richieste          | si          | si    | si       |
| Dipendenti         | si          | si    | no       |
| Impostazioni Store | si          | si    | no       |
| Audit Log          | si          | no    | no       |
| Info               | si          | si    | si       |

La sidebar e la bottom nav filtrano le voci in base al ruolo.

---

## 9. Pagina Login

- Pagina `/login` con un unico bottone "Accedi con Google"
- Chiama `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Dopo il redirect, `AuthProvider` verifica ruolo e store
- Se l'utente non ha un invito accettato, viene mostrato un messaggio di errore e la sessione viene invalidata

---

## 10. Prerequisito: Configurazione Google OAuth

Prima dell'implementazione, sara' necessario configurare il provider Google nella dashboard Supabase:
- Abilitare Google sotto Authentication > Providers
- Configurare Client ID e Client Secret dalla Google Cloud Console
- Impostare il redirect URL corretto

---

## Riepilogo Ordine di Implementazione

1. Configurazione Google OAuth nella dashboard Supabase
2. Migration: enum `app_role`, tabelle `profiles`, `user_roles`, `user_store_assignments`, `invitations`
3. Migration: trigger auto-creazione profilo al signup
4. Migration: funzioni helper `has_role`, `get_user_role`, `is_store_member`
5. Migration: RLS policies su tutte le tabelle auth
6. Frontend: AuthProvider, pagina Login, ProtectedRoute
7. Frontend: filtro navigazione per ruolo
8. Edge Function: gestione inviti (creazione + accettazione)

