

# UI Polish: Stato Attivo, Spaziatura e Arrotondamenti

## Modifiche richieste

### 1. Sfondo piu scuro (gradiente verde)
**File: `src/index.css`**
- Scurire il gradiente body da `#e8f5e9 / #c8e6c9 / #a5d6a7` a toni piu profondi: `#c8e6c9 0%, #a5d6a7 30%, #81c784 70%, #c8e6c9 100%`
- Aumenta il contrasto tra sfondo e card glassmorphism

### 2. Piu contrasto tra livelli glass
**File: `src/index.css`**
- `.glass-main-card`: background da `white/72` a `white/78`, shadow piu marcata `0 8px 32px rgba(0,0,0,0.10)`
- `.glass-sidebar-base`: background da `white/70` a `white/76`, shadow `0 4px 20px rgba(0,0,0,0.08)`
- `.glass-card`: background da `white/80` a `white/88`, shadow `0 2px 12px rgba(0,0,0,0.06)`
- `.glass-icon-card`: background da `white/82` a `white/90`

### 3. Tutto piu rotondo
**File: `src/index.css`**
- `.glass-main-card`: `border-radius: 24px` (da 20px)
- `.glass-sidebar-base`: `border-radius: 24px` (da 20px)
- `.glass-card`: `border-radius: 20px` aggiunto esplicitamente
- `.glass-icon-card`: `border-radius: 16px` (da 12px)

**File: `src/components/ui/card.tsx`**
- Card base: `rounded-[20px]` (da `rounded-[16px]`)

### 4. Icone sidebar completamente circolari
**File: `src/components/AppSidebar.tsx`**
- `.glass-icon-card` nella sidebar: override con `rounded-full` (rimangono `h-11 w-11`)
- La classe `.glass-icon-card` globale resta `rounded-[16px]`, ma nella sidebar si aggiunge `!rounded-full`

### 5. Giorno calendario: selezione circolare gia presente
Il calendario usa gia `rounded-full` per le celle. Confermato, nessuna modifica necessaria.

### 6. Card Profilo e Ferie: solo contenuto centrale
**File: `src/pages/Dashboard.tsx`**
- Card Profilo: rimuovere la riga "Nuova richiesta" con il pulsante `+` in basso. Tenere solo Avatar + Nome + Badge ruolo, centrati verticalmente
- Card Ferie: rimuovere l'icona Palmtree in alto e il testo "Ferie rimaste" in basso. Tenere solo il cerchio SVG con il numero, centrato

### 7. Hover piu evidente
**File: `src/index.css`**
- `.glass-card:hover`: aggiungere `transform: scale(1.015)` e shadow piu marcata `0 6px 24px rgba(0,0,0,0.10)`
- `.glass-icon-card:hover`: aggiungere `transform: scale(1.015)` e shadow `0 4px 16px rgba(0,0,0,0.09)`
- Aggiungere `transition: all 200ms ease` (gia presente come `transition: box-shadow`, estendere a `all`)

### 8. Stato attivo con bordo verde persistente
**File: `src/components/AppSidebar.tsx`**
- Icona attiva: aggiungere `border: 2px solid #00C853` (verde corporate)
- Rimuovere il cambio di background drastico, mantenere solo il bordo verde + colore icona verde
- Classe attiva: `border-2 border-[#00C853] text-[#00C853]` senza cambiare drasticamente il bg

**File: `src/pages/Dashboard.tsx`**
- Giorno selezionato nel calendario: gia usa `bg-primary` che e verde. Confermato OK.

### 9. Spaziatura globale aumentata
**File: `src/components/AppShell.tsx`**
- Main Card padding interno: da `px-4 py-3 md:px-5 md:py-4` a `px-8 py-8 md:px-8 md:py-8` (32px)

**File: `src/pages/Dashboard.tsx`**
- `cardBase`: padding da `p-2` a `p-6` (24px)
- Gap griglia: da `gap-3.5` a `gap-5` (20px)
- Padding griglia: da `p-3.5` a `p-0` (il padding e gia nella Main Card)

## Riepilogo file modificati

1. `src/index.css` - Gradiente piu scuro, contrasto livelli, bordi piu rotondi, hover piu evidente
2. `src/components/ui/card.tsx` - `rounded-[20px]`
3. `src/components/AppSidebar.tsx` - Icone circolari, stato attivo con bordo verde
4. `src/components/AppShell.tsx` - Padding 32px nella Main Card
5. `src/pages/Dashboard.tsx` - Card compatte (solo contenuto), padding 24px, gap aumentato

