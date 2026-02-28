

## Piano: Staffing Suggestions + Fix Dipendenti Demo

### Obiettivo
1. Aggiungere un suggerimento "Analisi Organico" nel pannello Health Check che mostra quanti dipendenti sono in surplus o in deficit rispetto alla copertura richiesta
2. Aggiornare la seed function per creare il numero corretto di dipendenti per ogni store/reparto

---

### Calcolo Organico Ideale

```text
Store                  Reparto   Ore/sett   Ideali   Attuali   Delta
Milano Duomo           Sala      210h       6        9         +3
Milano Duomo           Cucina    161h       5        8         +3
Milano Navigli         Sala      108h       3        0         -3
Milano Navigli         Cucina     84h       3        0         -3
Roma Trastevere        Sala      150h       4        8         +4
Roma Trastevere        Cucina    138h       4        8         +4
```

---

### Step 1: Suggerimento "Analisi Organico" nel motore di generazione

In `supabase/functions/generate-optimized-schedule/index.ts`, dopo i suggerimenti esistenti (surplus, hour deviation, smart suggestions), aggiungere un blocco che:

- Calcola `weeklyRequiredHours = somma(coverage_per_hour × 7_o_6_giorni)` per il reparto
- Calcola `idealCount = ceil(weeklyRequiredHours / contractHoursMedia)`
- Calcola `actualCount = numero dipendenti attivi nel reparto`
- Se `actualCount > idealCount`: suggerimento tipo `staffing_analysis` con severita `info`, titolo "Organico Sala: +N dipendenti rispetto al fabbisogno", descrizione con ore richieste vs capacita
- Se `actualCount < idealCount`: suggerimento tipo `staffing_analysis` con severita `warning`, titolo "Organico Cucina: -N dipendenti rispetto al fabbisogno"

Aggiungere `"staffing_analysis"` al tipo `OptimizationSuggestion` nel frontend (`useOptimizationSuggestions.ts`).

Nel `OptimizationPanel.tsx`, classificare `staffing_analysis` nel gruppo "equity" per mostrarlo nel pannello.

### Step 2: Aggiornare seed function con numeri corretti

Modificare `supabase/functions/seed-employee-test-data/index.ts`:

- Calcolare dinamicamente il numero di dipendenti necessari per store/reparto leggendo `store_coverage_requirements` dal database
- Formula: `ceil(somma_ore_settimanali / 40)`
- Prendere i primi N nomi dalle liste SALA/CUCINA (invece di tutti e 8)
- Per Milano Navigli (che ha 0 dipendenti) creare anche quelli

### Step 3: Deploy e ri-esecuzione

- Deploy della seed function aggiornata
- Esecuzione per ripulire i dipendenti in eccesso e ricreare quelli giusti
- Deploy del motore di generazione aggiornato

---

### Dettagli Tecnici

**Edge function `generate-optimized-schedule/index.ts`** (dopo riga ~1431, prima di "Update run"):
```typescript
// Staffing analysis suggestion
const totalWeeklyRequired = iterDates.reduce((sum, dateStr) => {
  const dow = getDayOfWeek(dateStr);
  const dayCov = coverageData.filter(c => c.department === dept && c.day_of_week === dow);
  return sum + dayCov.reduce((s, c) => s + c.min_staff_required, 0);
}, 0);
const avgContract = deptEmployees.reduce((s, e) => s + e.weekly_contract_hours, 0) / (deptEmployees.length || 1);
const idealCount = Math.ceil(totalWeeklyRequired / avgContract);
const actualCount = deptEmployees.length;
const delta = actualCount - idealCount;
if (delta !== 0) {
  deptSuggestions.push({
    id: `staffing-${dept}`,
    type: "surplus",
    severity: delta < 0 ? "warning" : "info",
    title: delta > 0
      ? `Organico ${deptLabel}: +${delta} rispetto al fabbisogno`
      : `Organico ${deptLabel}: ${delta} rispetto al fabbisogno`,
    description: `Servono ${totalWeeklyRequired}h/settimana (${idealCount} dipendenti ideali a ${avgContract}h). Presenti: ${actualCount}.`,
    actionLabel: "Info",
    declineLabel: "Ok",
    surplusCount: Math.abs(delta),
    surplusReason: delta > 0 ? "Surplus organico" : "Deficit organico",
  });
}
```

**Seed function**: calcolo dinamico basato su coverage reale del database, creazione solo del numero necessario di dipendenti per store/reparto.

