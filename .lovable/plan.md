

# Piano: Struttura Dati Gestione Dipendenti Multi-Store

## Panoramica

Il sistema attuale ha gia' `profiles` (dati Google), `user_roles` (ruolo globale) e `user_store_assignments` (associazione utente-store). Per la gestione operativa dei dipendenti servono tre nuove tabelle che estendono questo modello senza duplicarlo.

---

## 1. Nuovi Enum

### `department`
```text
sala | cucina
```

### `availability_type`
```text
available | unavailable
```

### `exception_type`
```text
ferie | permesso | malattia | modifica_orario | altro
```

---

## 2. Nuove Tabelle

### 2.1 `employee_details`

Dati operativi del dipendente, separati da `profiles` (che resta per dati Google). Relazione 1:1 con `profiles.id`.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid NOT NULL UNIQUE | FK -> profiles(id) ON DELETE CASCADE |
| department | department NOT NULL | sala o cucina |
| weekly_contract_hours | integer NOT NULL | default 40 |
| phone | text | nullable |
| is_active | boolean NOT NULL | default true |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

**Perche' tabella separata e non estensione di `profiles`?**
- `profiles` e' auto-popolata dal trigger Google OAuth e contiene solo dati identita'
- I dati operativi (reparto, ore contratto) sono gestiti da admin, non dall'utente
- Separazione netta: dati identita' vs dati lavorativi
- Lo `store_id` primario e' gia' in `user_store_assignments.is_primary`, non va duplicato

### 2.2 `employee_availability`

Disponibilita' ricorrente settimanale del dipendente.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid NOT NULL | FK -> profiles(id) ON DELETE CASCADE |
| store_id | uuid NOT NULL | FK -> stores(id) ON DELETE CASCADE |
| day_of_week | smallint NOT NULL | 0=lunedi' ... 6=domenica |
| start_time | time NOT NULL | es. 09:00 |
| end_time | time NOT NULL | es. 18:00 |
| availability_type | availability_type NOT NULL | default 'available' |
| created_at | timestamptz | default now() |

Vincolo UNIQUE su (user_id, store_id, day_of_week, start_time).
Vincolo CHECK: day_of_week tra 0 e 6.
Vincolo CHECK: end_time > start_time.

### 2.3 `employee_exceptions`

Eccezioni temporanee (ferie, permessi, malattia, modifiche orario).

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid NOT NULL | FK -> profiles(id) ON DELETE CASCADE |
| store_id | uuid NOT NULL | FK -> stores(id) ON DELETE CASCADE |
| exception_type | exception_type NOT NULL | |
| start_date | date NOT NULL | |
| end_date | date NOT NULL | |
| notes | text | nullable |
| created_by | uuid | FK -> profiles(id), chi ha creato l'eccezione |
| created_at | timestamptz | default now() |

Vincolo: end_date >= start_date (via trigger di validazione, non CHECK con now()).

---

## 3. Relazioni

```text
profiles (1) --- (1) employee_details
    |                    
    +--- (N) employee_availability
    |                    
    +--- (N) employee_exceptions
    |
    +--- (N) user_store_assignments --- stores
```

- `employee_details.user_id` -> `profiles.id`
- `employee_availability.user_id` -> `profiles.id`, `.store_id` -> `stores.id`
- `employee_exceptions.user_id` -> `profiles.id`, `.store_id` -> `stores.id`
- Lo store primario si ricava da `user_store_assignments WHERE is_primary = true`

---

## 4. Policy RLS

Tutte le tabelle usano le funzioni Security Definer gia' esistenti: `has_role()` e `is_store_member()`.

### 4.1 `employee_details`

| Operazione | Regola |
|------------|--------|
| SELECT | super_admin: tutto; admin: utenti dei propri store (join con user_store_assignments); employee: solo il proprio record (user_id = auth.uid()) |
| INSERT | super_admin: tutto; admin: solo per utenti nei propri store |
| UPDATE | super_admin: tutto; admin: solo per utenti nei propri store |
| DELETE | solo super_admin |

### 4.2 `employee_availability`

| Operazione | Regola |
|------------|--------|
| SELECT | super_admin: tutto; admin: dove is_store_member(uid, store_id); employee: solo propri record |
| INSERT | super_admin: tutto; admin: dove is_store_member(uid, store_id) |
| UPDATE | super_admin: tutto; admin: dove is_store_member(uid, store_id) |
| DELETE | super_admin: tutto; admin: dove is_store_member(uid, store_id) |

### 4.3 `employee_exceptions`

Stesse regole di `employee_availability`, con l'aggiunta che l'employee puo' fare INSERT delle proprie eccezioni (per richiedere ferie/permessi).

---

## 5. Trigger e Automazioni

1. **update_updated_at**: riutilizzare il trigger esistente `update_updated_at_column()` su `employee_details`
2. **Validazione date**: trigger BEFORE INSERT/UPDATE su `employee_exceptions` per verificare `end_date >= start_date`

---

## 6. Riepilogo Tecnico - Ordine Migrazione

1. Creare enum `department`, `availability_type`, `exception_type`
2. Creare tabella `employee_details` con FK, UNIQUE, trigger updated_at
3. Creare tabella `employee_availability` con FK, UNIQUE, CHECK
4. Creare tabella `employee_exceptions` con FK, trigger validazione
5. Abilitare RLS su tutte e tre le tabelle
6. Creare policy RLS per ciascuna tabella seguendo lo schema sopra

Nessuna modifica al frontend in questa fase.

