

## Piano: Ore settimanali visibili + Auto-risoluzione intelligente

### Parte 1: Visualizzazione ore settimanali

**Per il dipendente (PersonalCalendar.tsx)**:
- Aggiungere in alto una card/badge che mostra il totale ore settimanali assegnate vs ore contrattuali (es. "32h / 40h contratto")
- Calcolare il totale sommando la durata di tutti i turni non-day-off della settimana corrente

**Per l'admin (EmployeeWeekDrawer.tsx)**:
- Aggiungere nel header del drawer, sotto il nome e la settimana, un riepilogo: ore assegnate / ore contratto
- Recuperare le ore contrattuali dal prop `employee_details` (servira passare `weeklyContractHours` come prop dal TeamCalendar)
- Calcolare le ore dalla somma dei turni visibili nel drawer

### Parte 2: Auto-risoluzione nel motore di generazione

Il motore attualmente genera troppi suggerimenti. L'utente vuole vedere **solo**:
1. **Manca personale** → suggerimento di prestito inter-store
2. **Troppo personale** → suggerimento di prestare gente ad altri store

Tutto il resto (deviazioni orarie entro ±5h, surplus/deficit di slot singoli, bilanciamento equità, spezzati, giorni liberi) deve essere **risolto automaticamente** dal motore senza generare suggerimenti.

**Modifiche in `generate-optimized-schedule/index.ts`**:

1. **Eliminare suggerimenti `overtime_balance`**: le deviazioni orarie entro ±5h sono già automatiche, quelle oltre vengono gestite internamente estendendo/accorciando turni

2. **Eliminare suggerimenti `surplus` per slot singoli**: se c'è surplus su un singolo slot orario, il motore deve rimuovere automaticamente il turno in eccesso (assegnando alla persona con meno ore o più lontana dal contratto)

3. **Eliminare suggerimenti `smart-increase-splits` e `smart-increase-daysoff`**: il motore deve applicare queste modifiche automaticamente durante l'escalation (gia implementata), non proporle all'utente

4. **Mantenere solo 2 tipi di suggerimenti**:
   - `uncovered` con `alternatives` che contengono opzioni di **prestito inter-store** (quando non ci sono soluzioni interne)
   - `surplus` a livello **giornaliero aggregato** dove ci sono persone in piu rispetto alla copertura → suggerire di **prestarle** ad altri store

5. **Auto-risolvere surplus**: prima di generare suggerimenti surplus, il motore tenta automaticamente di ridurre i turni delle persone in surplus (accorciandoli o rimuovendoli) mantenendo la copertura esatta. Solo se il surplus persiste per mancanza di opzioni, viene suggerito il prestito

6. **Suggerimento staffing_analysis**: eliminarlo dai suggerimenti (resta nei log come info)

### Dettagli tecnici

**PersonalCalendar.tsx**:
- Query `employee_details` per ottenere `weekly_contract_hours` dell'utente loggato
- Sommare ore dei turni della settimana corrente
- Mostrare badge in alto: `{totalHours}h / {contractHours}h`

**EmployeeWeekDrawer.tsx**:
- Aggiungere prop `weeklyContractHours: number`
- Calcolare totale ore dai turni nel drawer
- Mostrare nel header sotto il weekLabel

**TeamCalendar.tsx**:
- Passare `weeklyContractHours` al drawer dall'`employee_details` del dipendente selezionato

**generate-optimized-schedule/index.ts** (sezione suggerimenti ~riga 2974-3233):
- Rimuovere generazione suggerimenti `surplus` per slot singoli → auto-ridurre turni
- Rimuovere suggerimenti `overtime_balance` → gestiti internamente
- Rimuovere suggerimenti `smart-increase-splits` → applicare automaticamente durante escalation
- Rimuovere suggerimenti `smart-increase-daysoff` → applicare automaticamente
- Rimuovere suggerimenti `staffing_analysis` → solo log
- Mantenere solo `uncovered` senza alternative interne → proporre prestito inter-store
- Aggiungere suggerimento `lending` per surplus persistente → proporre di prestare persone

