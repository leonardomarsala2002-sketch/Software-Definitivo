

## Piano: Copertura con Range Min-Max

Sì, dare un range (min-max) al motore ridurrebbe significativamente gli errori. Attualmente il motore ha un solo numero fisso come target: se assegna 1 persona in meno è "buco", se ne assegna 1 in più è "overbooking". Con un range, il motore ha flessibilità per bilanciare le ore contrattuali di ciascuno senza violare la copertura.

### Come funziona

- **Min** = personale minimo obbligatorio (sotto = errore)
- **Max** = limite massimo accettabile (sopra = overbooking)
- Tra min e max = zona sicura dove il motore può ottimizzare liberamente le ore contrattuali

Esempio: slot 12:00-13:00 con min=2, max=4 → il motore può mettere 2, 3 o 4 persone a seconda di quante ore deve completare per rispettare i contratti.

### Modifiche

#### 1. UI Copertura (`CoverageModal.tsx`)

- Aggiungere uno switch "Abilita range" (già presente `max_staff_required` nel DB)
- Quando attivo, ogni slot mostra 2 stepper: Min e Max
- Quando disattivo, il valore inserito vale sia come min che come max (comportamento attuale = numero esatto)
- Il salvataggio invia sia `min_staff_required` che `max_staff_required`
- La copia tra giorni copia entrambi i valori

#### 2. Hook `useStoreSettings` + tipo `CoverageReq`

- Aggiungere `max_staff_required` al tipo `CoverageReq` e alla query/salvataggio
- Passare il valore max al salvataggio DB

#### 3. Motore di generazione (`generate-optimized-schedule/index.ts`)

- Leggere `max_staff_required` dalla query coverage
- Passarlo nel contesto AI e nella logica di validazione
- **Fitness function**: penalizzare solo se sotto min o sopra max (non più se diverso dal numero esatto)
- **autoCorrectViolations**: rimuovere turni solo se si supera max, non se si supera min+1
- **Prompt AI Gemini**: spiegare che la copertura è un range e che qualsiasi valore tra min e max è accettabile
- **Suggerimenti**: segnalare "manca personale" solo se sotto min, "troppo personale" solo se sopra max

### Dettagli tecnici

Il campo `max_staff_required` esiste già nel DB (`store_coverage_requirements.max_staff_required`, nullable). Quando è NULL, il motore userà `min_staff_required` come valore esatto (backward compatible). Quando è valorizzato, il motore lavora nel range.

