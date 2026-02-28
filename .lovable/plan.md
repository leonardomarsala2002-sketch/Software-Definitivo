

## Problemi identificati

1. **Colori turni nella Dashboard**: La timeline settimanale della Dashboard usa colori fissi (`bg-primary/20`, `border-primary/30`, `text-primary`) invece di usare `getShiftColor()`. Questo è il motivo per cui i turni appaiono tutti dello stesso colore verde.

2. **Navigazione settimane mancante**: La timeline mostra solo la settimana corrente, senza frecce per navigare avanti/indietro.

## Piano

### 1. Applicare colori turni nella Dashboard (`src/pages/Dashboard.tsx`)

- Importare `getShiftColor` da `@/lib/shiftColors`
- Nella sezione employee timeline (riga ~296-308), sostituire le classi hardcoded con quelle restituite da `getShiftColor(s)`:
  - `bg-primary/20` → `color.bg`
  - `border-primary/30` → `color.border`
  - `text-primary` → `color.text`

### 2. Aggiungere navigazione settimanale (`src/pages/Dashboard.tsx`)

- Aggiungere uno stato per l'offset settimana (`weekOffset`, default 0)
- Calcolare `selectedDate` come `today + weekOffset * 7 giorni`
- Aggiungere frecce ChevronLeft/ChevronRight nell'header della card "Il mio orario settimanale"
- Aggiungere un pulsante "Oggi" per tornare alla settimana corrente
- Aggiornare il range di date mostrato nel sottotitolo

