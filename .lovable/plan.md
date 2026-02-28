

## Analisi: perche i turni non coprono 13-15 senza overbooking

### Il problema strutturale

```text
Copertura Sala Milano Duomo (ogni giorno):
Ora:    09  10  11  12  13  14  15  16  17  18  19  20  21  22  23
Staff:   2   2   3   3   4   4   1   1   1   1   2   2   2   1   1
                              ↑↑ PICCO    ↑ CROLLO
```

Il motore assegna i turni in modo **greedy**: per ogni dipendente, sceglie il turno che copre il MASSIMO numero di ore scoperte. Questo porta a turni lunghi (es. 11-17) che attraversano il confine 14→15 dove la copertura crolla da 4 a 1. Una volta che 1 persona copre l'ora 15, il check anti-overbooking blocca OGNI altro turno che include l'ora 15.

**Esempio concreto di come fallisce oggi:**
1. E1 prende 9-15 (6h) → copre 6 ore scoperte. OK
2. E2 prende 9-15 (6h) → copre 6 ore scoperte. OK
3. E3 prende 11-17 (6h, copre 6 ore scoperte) → ora 15 ha 1 persona ✓
4. E4 vuole coprire 13-14 → tutti i turni validi (13-16, 12-15) includono ora 15 → **OVERBOOK → RIFIUTATO**

**Esempio di come DOVREBBE funzionare:**
1. E1: 9-15 (6h) → copre 9,10,11,12,13,14
2. E2: 9-15 (6h) → copre 9,10,11,12,13,14
3. E3: 11-15 (4h) → copre 11,12,13,14 ← turno PIU CORTO
4. E4: 13-16 (3h) → copre 13,14,15 ← unico a coprire ora 15
5. E5: 17-24 (7h) → copre sera
6. E1 split: 19-22 (3h) → copre serata

Risultato: **ZERO overbooking, ZERO buchi, 1 spezzato**

### Perche il motore non trova questa soluzione

Il criterio di selezione turno (riga 528) e:
```
if (coverCount > bestCoverage) → prendi il turno che copre PIU ore
```

Questo fa si che E3 prenda sempre 11-17 (6 ore coperte) invece di 11-15 (4 ore coperte). La scelta localmente migliore (6 > 4) impedisce la soluzione globale ottimale.

### Si, si puo risolvere SENZA overbooking

La soluzione: **variare la strategia di selezione turni tra le iterazioni**. In alcune iterazioni preferire turni corti e mirati, in altre turni lunghi. Con 40 tentativi, il motore trovera la combinazione giusta.

---

## Piano di implementazione

### Step 1: Strategia di selezione variata per iterazione

**File:** `supabase/functions/generate-optimized-schedule/index.ts`

Aggiungere un parametro `preferShortShifts: boolean` alla funzione `runIteration`. Quando attivo:
- Calcolare i "punti di transizione" dove la copertura cala di 2+ unita (es. ora 15: 4→1)
- Nella selezione del turno migliore, preferire turni che FINISCONO a un punto di transizione
- A parita di `coverCount`, preferire il turno piu corto (gia fatto) ma anche: se un turno corto copre almeno 1 ora scoperta con `coverCount/duration` (densita) migliore, preferirlo

Concretamente, nelle iterazioni pari usare la strategia attuale (max coverage), nelle dispari usare la strategia "turno minimo sufficiente" con preferenza per exit ai punti di transizione.

### Step 2: Budget ore per spezzati

**File:** stesso

Riga 607-608: nel secondo pass (split shifts), usare `maxRemainingWeekly` invece di `Math.min(..., maxRemainingTarget)`. Chi ha esaurito le ore contrattuali puo fare lo spezzato fino al massimo settimanale.

### Step 3: Distribuzione equa degli spezzati

**File:** stesso

Riga 591: dopo lo shuffle, ordinare i candidati per numero crescente di spezzati settimanali gia assegnati (chi ha 0 viene prima di chi ne ha 1).

### Step 4: Deploy e test

Deploy della edge function e rigenerazione turni per verificare che:
- Il picco 13-15 sia coperto da 4 persone
- Non ci sia overbooking in nessuna ora
- Gli spezzati siano distribuiti equamente

---

### Dettaglio tecnico della modifica principale

**Funzione `runIteration`** — nuovo parametro e logica:

```typescript
function runIteration(
  ..., preferShortShifts: boolean, ...
) {
  // Prima del loop giornaliero: calcola transition exits
  // (ore dove la copertura cala di 2+ rispetto all'ora precedente)
  
  // Nel loop di selezione turno (righe 503-533):
  if (preferShortShifts) {
    // Strategia: preferisci turni che finiscono a un transition exit
    // e che hanno la miglior densita (coverCount / duration)
    const density = coverCount / duration;
    const endsAtTransition = transitionExits.has(exit);
    const bonus = endsAtTransition ? 1000 : 0;
    const score = density + bonus;
    if (score > bestScore) { ... }
  } else {
    // Strategia attuale: max coverCount, poi min duration
  }
}
```

**Chiamata** (riga 1028): alternare `preferShortShifts` tra iterazioni:
```typescript
const preferShort = i % 2 === 1;
const result = runIteration(..., preferShort, ...);
```

Questo garantisce che meta delle iterazioni provi turni corti e mirati, aumentando la probabilita di trovare la combinazione ottimale senza overbooking.

