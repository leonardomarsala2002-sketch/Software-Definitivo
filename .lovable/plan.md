
# Refactoring totale del layout Dashboard

## Nuova griglia

Il layout attuale e una griglia 4 colonne x 2 righe con tutte le card nella riga 1 della stessa dimensione. Il nuovo layout richiede una disposizione completamente diversa, simile a quadranti.

### Struttura della griglia

```text
+------------------+----------+-----------------------------+
|  Profilo (small) | Richieste|                             |
+------------------+ (vertical)|   Calendario Mensile       |
|  Ferie (small)   |          |   (grande, quadrante DX)    |
+------------------+----------+-----------------------------+
|                  Agenda Settimanale                        |
|                  (intera larghezza, altezza ridotta)       |
+-----------------------------------------------------------+
```

La griglia CSS sara definita con `grid-template-columns` e `grid-template-rows` espliciti e `grid-template-areas` per posizionare ogni card nella sua area:
- **Colonne**: `auto auto 1fr` (Profilo/Ferie stretti, Richieste stretto, Calendario occupa tutto il resto)
- **Righe**: `1fr auto` (riga superiore flessibile, agenda in basso compatta)
- **Areas**:
  - `"profile requests calendar"`
  - `"vacation requests calendar"`
  - `"agenda agenda agenda"`

### Gap e padding
- `gap-3.5` (14px) tra tutte le card
- `p-3.5` (14px) padding del contenitore per mostrare lo sfondo su tutti i bordi

## Modifiche per card

### File: `src/pages/Dashboard.tsx`

**Card Profilo** (alto-sinistra, piccola)
- Area: `profile`
- Dimensioni ridotte, si adatta al contenuto (`h-fit` o `self-start` non serve perche la griglia con areas gestisce tutto)
- Rimane compatta come adesso

**Card Ferie** (sotto Profilo, piccola)
- Area: `vacation`
- Stessa colonna del profilo, sotto di esso
- Rimane compatta, adattata al contenuto

**Card Richieste** (centro, verticale)
- Area: `requests` (si estende su 2 righe: profile e vacation)
- `grid-row: 1 / 3` per occupare entrambe le righe della colonna centrale
- Layout verticale con lista scrollabile se necessario

**Card Calendario** (quadrante destro intero)
- Area: `calendar` (si estende su 2 righe)
- `grid-row: 1 / 3` per occupare tutto il quadrante superiore destro
- Celle del calendario piu grandi per riempire lo spazio
- Font e padding aumentati proporzionalmente rispetto alla versione mini

**Card Agenda** (intera larghezza, bassa)
- Area: `agenda`
- `min-h-[80px]` rimosso, altezza ridotta al minimo necessario
- Empty state compatto

### Stile visivo

**glass-card aggiornato** in `src/index.css`:
- Cambiare `border: 1px solid rgba(0, 200, 83, 0.22)` a `border: 1px solid rgba(255, 255, 255, 0.20)` (no verde)
- Cambiare `background: rgba(255, 255, 255, 0.58)` a `rgba(255, 255, 255, 0.40)` per piu trasparenza
- Aggiungere `backdrop-filter: blur(24px)` (da 16px a 24px) per effetto opalescente

**Badge ruolo**: rimuovere colori verdi, usare sfondo neutro `bg-foreground/10 text-foreground/70 border-foreground/20`

**Hover card**: la classe `glass-card` non deve avere effetti di scala/traslazione. Solo una leggera variazione di ombra se presente.

**Cerchio progresso ferie**: cambiare `text-[#111]` a `text-foreground` (gia nero, ma coerente)

**Pulsante "today" nel calendario e selezione**: `bg-primary` resta perche primary e gia definito nel tema, ma il badge ruolo perde il verde esplicito.

## Fix tecnici

1. **No clipping**: tutte le card usano `overflow-hidden` dove necessario, nessun effetto hover che sposta elementi
2. **No scroll**: il contenitore resta `h-full overflow-hidden` con griglia flessibile
3. **Hover minimo**: nessun transform/scale sulle card, solo variazione ombra/bordo gia gestita dalle regole esistenti (gia conformi)

## File modificati

1. `src/pages/Dashboard.tsx` - Riscrittura della griglia e riposizionamento card
2. `src/index.css` - Aggiornamento `.glass-card` (bordo bianco invece di verde, bg piu trasparente)
