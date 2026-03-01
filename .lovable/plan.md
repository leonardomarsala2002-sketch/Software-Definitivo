

## Piano: Correzione regole generazione per store

### Problemi identificati

1. **Log ambigui**: il testo "Ore settimanali: da contratto individuale (NON valore generico store)" e "Tolleranza massima: +5h/sett solo se approvato manualmente" sono fuorvianti. Le regole sono GIA per-store, ma il log non lo comunica chiaramente.
2. **±5h manuale**: il prompt AI e i log dicono "solo se approvato manualmente", ma il comportamento corretto e che la tolleranza ±5h si applichi **automaticamente** se risolve buchi di copertura.
3. **Giorni liberi**: il log mostra 0. Devono essere minimo 1, massimo 2, e **uguali per tutti** i dipendenti standard.
4. **Spezzati**: il log mostra 0. Devono partire da minimo 1, massimo 3, **uguali per tutti**, e aumentare solo quando servono per coprire buchi.

### Modifiche

#### 1. Edge Function `generate-optimized-schedule/index.ts`

**Log input** (riga ~1187-1195):
- Sostituire testo generico con riferimento esplicito allo store: `REGOLE DI QUESTO STORE:`
- Rimuovere "solo se approvato manualmente" → scrivere `Tolleranza: ±5h/sett automatica se necessaria per copertura`
- Mostrare range: `Giorni liberi: min 1 — max 2 per dipendente (uguali per tutti)`
- Mostrare range: `Spezzati: min 1 — max ${rules.max_split_shifts_per_employee_per_week} (uguali per tutti, aumentano solo se servono)`

**Prompt AI Gemini** (riga ~464):
- Rimuovere "con approvazione manuale" → `La tolleranza ±5h/sett si applica automaticamente se necessaria per coprire buchi di copertura`

**Logica giorni liberi** (pre-planning riga ~1132+):
- Garantire che `mandatory_days_off_per_week` sia sempre >= 1 (floor clamp)
- Il massimo giorni liberi assegnabili e 2 (cap)

**Logica spezzati** (escalation e iterazione):
- Il minimo spezzati per strategia e 1 (non 0)
- In `equalizeEquity`: garantire che tutti gli standard abbiano lo stesso numero di split, partendo da 1

**Auto-approvazione ±5h**:
- Nella logica di deficit/surplus post-generazione, applicare automaticamente fino a ±5h per dipendente se il bilancio copertura lo richiede, senza generare suggerimento di approvazione manuale

#### 2. UI `RulesModal.tsx`

- Aggiornare i limiti min/max dei NumberStepper:
  - Giorni liberi: `min={1}` `max={2}`
  - Spezzati: `min={1}` `max={3}`

#### 3. Aggiornamento DB per lo store corrente

- Migrazione SQL: per lo store `a0000001-0000-0000-0000-000000000001`, impostare `mandatory_days_off_per_week = 1` e `max_split_shifts_per_employee_per_week` al valore corretto se attualmente 0.
- Aggiungere constraint CHECK su `store_rules` per garantire `mandatory_days_off_per_week >= 1` e `max_split_shifts_per_employee_per_week >= 1`.

