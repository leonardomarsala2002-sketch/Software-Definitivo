# Rule Engine

Il rule engine è un modulo TypeScript puro (no Deno, no Supabase) in `supabase/functions/_shared/scheduling-engine/`. Valida ogni turno in modo deterministico e produce un quality score.

## Struttura moduli

```
scheduling-engine/
  index.ts         # Entry point — runFullValidation(), computeQualityScore()
  types.ts         # Tipi condivisi (Shift, StoreRule, Violation, ecc.)
  hard-rules.ts    # Regole che bloccano la pubblicazione
  soft-rules.ts    # Regole di ottimizzazione (peso nel quality score)
  validator.ts     # Orchestratore: applica hard + soft, produce ValidationResult
  quality-score.ts # Calcola score 0–100 da violations e metriche
  lifecycle.ts     # Helpers: getWeekStart(), isPublishable(), regenRange()
```

## Hard rules — bloccanti

Le hard rules producono violazioni che **impediscono la pubblicazione** del turno.

| Regola | Descrizione |
|---|---|
| `max_daily_hours` | Il turno non può superare il limite giornaliero (store_rules.max_daily_hours_per_employee) |
| `min_daily_hours` | Il turno non può essere più corto del minimo (store_rules.min_daily_hours_per_employee) |
| `approved_time_off` | Nessun turno se il giorno ha una richiesta approvata (ferie, permesso, permesso_104, malattia) |
| `outside_opening_hours` | Il turno non può iniziare prima dell'apertura o finire dopo la chiusura |
| `mandatory_day_off` | Rispettare i giorni di riposo obbligatori per settimana (store_rules.mandatory_days_off_per_week) |
| `contract_hours_exceeded` | Ore settimanali assegnate non possono superare le ore contratto di oltre 2× la tolleranza |

## Soft rules — ottimizzazione

Le soft rules producono **warning** e influenzano il quality score, ma non bloccano.

| Regola | Peso | Descrizione |
|---|---|---|
| `contract_hours_tolerance` | 20 | Ore settimanali entro ±5h dal contratto |
| `min_coverage` | 25 | Copertura minima rispettata per ogni slot orario |
| `preferred_day_off` | 10 | Rispetto dei giorni liberi preferiti dal dipendente |
| `preferred_shift_type` | 10 | Rispetto del tipo turno preferito (mattina/pomeriggio/sera) |
| `opening_closing_preference` | 5 | Rispetto preferenza apertura/chiusura |
| `weekend_availability` | 10 | Weekend assegnato solo se dipendente è disponibile |
| `hour_distribution` | 10 | Distribuzione ore nella settimana (uniforme/front-loaded/back-loaded) |
| `historical_balance` | 10 | Compensazione squilibri settimanali rispetto alle 4 settimane precedenti |

## Validation flow

```typescript
// 1. Esegui hard rules su ogni singolo turno
const hardViolations = checkHardRules(shift, context);
if (hardViolations.length > 0) {
  return { isValid: false, hardViolations, ... };
}

// 2. Esegui soft rules sull'insieme dei turni della settimana
const softViolations = checkSoftRules(shifts, context);

// 3. Calcola quality score
const score = computeQualityScore(shifts, softViolations, context);

// 4. Auto-correzioni (se possibile)
const { corrected, appliedCorrections } = autoCorrect(shifts, hardViolations, context);

return {
  isValid: hardViolations.length === 0,
  shifts: corrected,
  hardViolations,
  softWarnings: softViolations,
  qualityScore: score,
  autoCorrectionsApplied: appliedCorrections,
};
```

## Quality Score

Il quality score è un numero da **0 a 100**. Viene calcolato sottraendo penalità dalle soft violations:

```
score = 100 - Σ (peso_regola × numero_violazioni_normalizzate)
```

Soglie:
- **≥ 80**: Ottimo (verde)
- **60–79**: Buono (giallo)
- **< 60**: Critico (rosso)

Il score viene salvato in `generation_runs` e visualizzato nella `QualityScoreCard` della dashboard.

## Come aggiungere una nuova regola

### Hard rule

1. Apri `hard-rules.ts`
2. Aggiungi una funzione `check<NomeRegola>(shift: Shift, ctx: ValidationContext): Violation[]`
3. Aggiungi la chiamata alla funzione nella funzione `checkHardRules()` che aggrega tutte le hard rules
4. Aggiungi il tipo `rule` alla union type `HardRuleId` in `types.ts`

```typescript
// Esempio: hard-rules.ts
function checkMaxDailyHours(shift: Shift, ctx: ValidationContext): Violation[] {
  const maxH = ctx.storeRules.maxDailyHoursPerEmployee;
  const shiftH = hoursBetween(shift.startTime, shift.endTime);
  if (shiftH > maxH) {
    return [{
      rule:        "max_daily_hours",
      severity:    "hard",
      employeeId:  shift.userId,
      date:        shift.date,
      description: `Turno di ${shiftH}h supera il massimo di ${maxH}h`,
    }];
  }
  return [];
}
```

### Soft rule

1. Apri `soft-rules.ts`
2. Aggiungi una funzione `check<NomeRegola>(shifts: Shift[], ctx: ValidationContext): SoftViolation[]`
3. Aggiungi la chiamata in `checkSoftRules()`
4. Aggiungi il peso nella mappa `SOFT_RULE_WEIGHTS` in `quality-score.ts`

```typescript
// Esempio: soft-rules.ts
function checkPreferredDayOff(shifts: Shift[], ctx: ValidationContext): SoftViolation[] {
  const violations: SoftViolation[] = [];
  for (const shift of shifts) {
    const prefs = ctx.employeePreferences?.get(shift.userId);
    if (!prefs || shift.isDayOff) continue;
    const dow = getDayOfWeek(shift.date); // 0=Mon
    if (prefs.preferredDaysOff?.includes(DAYS[dow])) {
      violations.push({ rule: "preferred_day_off", severity: "soft", employeeId: shift.userId, date: shift.date });
    }
  }
  return violations;
}
```

## Copertura festivi

I festivi italiani sono gestiti tramite la lista `ITALIAN_HOLIDAYS` in `types.ts`. Quando una data è festiva, la copertura minima richiesta per ogni slot viene aumentata del 20%:

```typescript
const adjustedMin = isHoliday(date)
  ? Math.ceil(slot.minStaffRequired * 1.2)
  : slot.minStaffRequired;
```

## Test del rule engine

I test sono in `src/test/scheduling-engine/`:
- `hard-rules.test.ts` — test parametrici su ogni hard rule
- `soft-rules.test.ts` — test su regole soft e pesi
- `validator.test.ts` — test integrazione: input → ValidationResult

Tutti i test usano Vitest e non hanno dipendenze Supabase/Deno.
