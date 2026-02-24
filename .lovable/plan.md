
# Calendario: celle responsive che si adattano alla viewport

## Problema
Le celle del calendario hanno altezze minime fisse (`min-h-[60px]`) e contenuto testuale che non si riduce. Quando il mese ha 5-6 righe, le ultime escono dalla viewport.

## Soluzione

### 1. Rimuovere altezze minime fisse
- Eliminare `min-h-[60px]` dalle celle vuote
- Le righe devono occupare esattamente `1fr` dello spazio disponibile, senza forzare dimensioni

### 2. Contenere ogni cella nel suo spazio
- Aggiungere `overflow: hidden` su ogni cella del giorno
- Il contenuto che non entra viene semplicemente nascosto (non spinge la cella)

### 3. Nascondere i testi quando lo spazio e troppo piccolo
Usare un approccio CSS con container queries o un semplice calcolo basato sul numero di righe:
- Se il mese ha 6 righe: mostrare solo il numero del giorno e al massimo 1-2 turni
- Se ha 5 righe: mostrare fino a 3 turni
- Se ha 4 righe: mostrare fino a 4 turni (comportamento attuale)

Questo viene calcolato nel componente (`totalWeeks` e passato come prop da `TeamCalendar`) per decidere quanti turni mostrare.

### 4. Numero giorno compatto
- Ridurre padding e margini del numero del giorno
- Il cerchio verde del "oggi" diventa piu piccolo (w-5 h-5, text-[10px])

---

## Dettagli tecnici

### File: `src/components/team-calendar/MonthGrid.tsx`

**Props nuova:** `totalWeeks: number` (numero di righe nel mese)

**Celle vuote:** da `min-h-[60px]` a nessuna altezza minima

**Celle giorno:**
- Aggiungere `overflow-hidden` e `min-h-0`
- Calcolare `maxVisibleShifts` in base a `totalWeeks`:
  - 6 righe: max 1 turno visibile
  - 5 righe: max 2 turni
  - 4 righe: max 4 turni
- Il contatore "+N altri" appare solo se c'e spazio

**Numero giorno:**
- `mb-0.5` invece di `mb-1`
- Cerchio oggi: `w-5 h-5 text-[10px]`

### File: `src/pages/TeamCalendar.tsx`

- Passare `totalWeeks` come prop a `MonthGrid` (gia calcolato alla riga 213)
