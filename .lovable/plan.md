# Dashboard Cards: riduzione proporzionale di tutte le card

## Obiettivo

Ridurre le dimensioni interne di tutte le card della dashboard (font, icone, avatar, padding, margini) in modo proporzionale, mantenendo circa 14px di spazio visibile tra le card dove si vede lo sfondo, e tra i bordi del div contenitore.

## Stato attuale

- Gap tra card: `gap-3.5` (14px) -- gia corretto
- Padding card: `p-1.5` (6px)
- Avatar profilo: `h-10 w-10`
- Icone: `h-3.5 w-3.5`
- Contenitori icone: `h-6 w-6`
- Cerchio ferie: `h-14 w-14`
- Font: `text-sm`, `text-xs`, `text-[11px]`, `text-[10px]`
- Pulsanti azioni richieste: `h-7 w-7`
- Celle calendario: `h-6 w-6`

## Modifiche previste

File: `src/pages/Dashboard.tsx`

### Card base

- Padding da `p-1.5` a `p-1` (4px)
- Border-radius da `rounded-[14px]` a `rounded-[12px]`

### Card Profilo (riga 1, colonna 1)

- Avatar: da `h-10 w-10` a `h-8 w-8`
- Nome: da `text-sm` a `text-xs`
- Badge ruolo: da `text-[10px]` a `text-[9px]`, padding ridotto
- Pulsante "nuova richiesta": da `h-7 w-7` a `h-6 w-6`
- Testo "Nuova richiesta": da `text-xs` a `text-[10px]`
- Gap tra avatar e testo: da `gap-2` a `gap-1.5`

### Card Ferie (riga 1, colonna 2)

- Contenitore icona: da `h-6 w-6` a `h-5 w-5`
- Cerchio SVG: da `h-14 w-14` a `h-11 w-11`, viewBox regolato
- Numero ferie: da `text-base` a `text-sm`
- Testo "Ferie rimaste": da `text-[10px]` a `text-[9px]`
- Margini ridotti (`mb-1` a `mb-0.5`)

### Card Calendario (riga 1, colonna 3)

- Titolo mese: da `text-[11px]` a `text-[10px]`
- Pulsanti nav mese: da `h-5 w-5` a `h-4 w-4`
- Header giorni: da `text-[9px]` a `text-[8px]`
- Celle giorno: da `h-6 w-6` a `h-5 w-5`, font da `text-[10px]` a `text-[9px]`

### Card Richieste/Avvisi (riga 1, colonna 4)

- Contenitore icona: da `h-6 w-6` a `h-5 w-5`
- Titolo: da `text-[11px]` a `text-[10px]`
- Badge contatore: da `h-5` a `h-4`
- Pulsanti approva/rifiuta: da `h-7 w-7` a `h-5 w-5`
- Icone check/X: da `h-4 w-4` a `h-3 w-3`

### Card Agenda Settimanale (riga 2, intera larghezza)

- Contenitore icona header: da `h-6 w-6` a `h-5 w-5`
- Titolo: da `text-xs` a `text-[10px]`
- Icona vuota: da `h-8 w-8` a `h-6 w-6`
- Testi vuoti: da `text-[11px]`/`text-[10px]` a `text-[10px]`/`text-[9px]`
- Empty state min-height: da `min-h-[120px]` a `min-h-[80px]`

Tutte le modifiche sono nel singolo file `src/pages/Dashboard.tsx`.