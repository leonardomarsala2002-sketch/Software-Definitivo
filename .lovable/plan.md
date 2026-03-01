

## Analisi del problema

Ho analizzato il motore in dettaglio. Il problema fondamentale è che **Gemini controlla solo 4 parametri** (`maxSplits`, `preferShort`, `randomize`, `reserveForSplit`), ma l'assegnazione dei turni resta un algoritmo greedy che:

1. **Non pre-pianifica i giorni liberi** — li assegna passivamente (riga 1260-1270: "se non lavori oggi, è giorno libero"). Non c'è garanzia che ogni dipendente ne abbia almeno 1.
2. **Non corregge le violazioni** — la `postValidateShifts` rileva i problemi ma non li risolve. Le ~20 violazioni che vedi restano nel risultato finale.
3. **Non adatta le variabili** — se 40 strategie falliscono tutte con violazioni, il sistema non prova ad aumentare spezzati o giorni liberi automaticamente.

## Piano di implementazione

### 1. Pre-pianificazione giorni liberi obbligatori

Prima del loop giornaliero in `runIteration`, assegnare proattivamente almeno 1 giorno libero per dipendente:
- Calcolare il fabbisogno per giorno
- Ordinare i giorni per fabbisogno crescente
- Per ogni dipendente (shuffled), assegnare 1 giorno libero nel giorno a minor fabbisogno
- Nel loop giornaliero, escludere chi ha il giorno libero pre-assegnato

### 2. Auto-correzione post-validazione

Dopo `postValidateShifts`, aggiungere un ciclo di correzione automatica:
- **Ore giornaliere eccessive**: accorciare il turno più lungo del dipendente in quel giorno
- **Ore settimanali eccessive**: rimuovere il turno nel giorno con meno copertura richiesta
- **Troppi spezzati**: rimuovere lo spezzato nel giorno con meno copertura richiesta
- **Giorni liberi insufficienti**: rimuovere tutti i turni nel giorno a minor fabbisogno per quel dipendente
- **Riposo 11h violato**: posticipare l'inizio del turno del giorno successivo

Questo riduce drasticamente le violazioni da ~20 a quasi 0.

### 3. Loop adattivo con escalation automatica delle variabili

Nel main handler (riga 1672-1694), dopo aver provato tutte le 40 strategie, se la soluzione migliore ha ancora violazioni:
- **Round 2**: ri-eseguire le top 10 strategie con `mandatory_days_off + 1`
- **Round 3**: ri-eseguire con `max_split_shifts + 1`
- **Round 4**: ri-eseguire con entrambi

Tracciare nel report quali adattamenti sono stati applicati. L'admin vede nel pannello Health Check: "Adattamento automatico: giorni liberi portati a 2 per garantire equità".

### 4. Distribuzione equa degli spezzati nel secondo pass

Nel secondo pass (riga 950-1107), ordinare i candidati per numero **crescente** di spezzati settimanali già assegnati. Chi ha 0 spezzati viene prima di chi ne ha 1.

### File coinvolto

Unico file: `supabase/functions/generate-optimized-schedule/index.ts`

### Risultato atteso

- Ogni dipendente ha almeno 1 giorno libero garantito
- Max 3 spezzati a testa, distribuiti equamente
- Le violazioni post-validazione vengono corrette automaticamente
- Se le regole standard non bastano, il sistema prova varianti adattive prima di arrendersi
- Report dettagliato su quali adattamenti sono stati necessari

