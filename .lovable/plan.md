

# UI Consistency: Stato Attivo, Card Uniformi, Colori Accesi

## Problemi identificati

1. **Employees page**: le card Sala e Cucina usano `bg-white/[0.06]` con bordi colorati (`border-orange-400/20`, `border-emerald-400/20`) -- completamente diversi dal sistema `glass-card`
2. **Employee row cards**: usano `bg-white/10` con bordi colorati, non il glass system
3. **Pulsante "Nuovo invito"**: `bg-purple-600` invece del sistema glass con bordo verde attivo
4. **Bordi colorati**: varie card hanno bordi arancioni/verdi/ambra che devono essere neutralizzati
5. **Verdi e rossi poco accesi**: colori come `emerald-500`, `amber-500`, `destructive` vanno intensificati

## Modifiche

### 1. `src/pages/Employees.tsx` -- Card Sala/Cucina uniformi al glass system

**Card contenitore Sala**: da `rounded-[32px] border border-orange-400/20 bg-white/[0.06]` a `glass-card` (stesse proprietà di tutte le inner card: `white/88`, `backdrop-blur-[10px]`, bordo `white/0.35`, `rounded-[20px]`)

**Card contenitore Cucina**: identico, usa `glass-card`

**Employee row card**: da `border-orange-400/30 bg-white/10` a `glass-card` con padding ridotto (`p-3`), bordo neutro (nessun colore), stessa opacità `white/88`

**Pulsante "Nuovo invito"**: da `bg-purple-600 rounded-full` a `glass-icon-card !rounded-full` con stato default bianco. Al click/attivo: `border-2 border-[#00C853]` (stesso pattern della sidebar)

### 2. `src/index.css` -- Colori piu accesi

**Verde acceso**: CSS variable `--success` e `.text-emerald-*` dove usati, saranno intensificati tramite l'uso diretto di `#00C853` (verde brillante) al posto di `emerald-500`

**Rosso acceso**: CSS variable `--destructive` da `14 100% 50%` a `0 100% 50%` (rosso puro, piu intenso). Gli indicatori "giorno libero" e "inattivo" useranno questo rosso piu vivido.

**Bordi card neutri**: conferma che `.glass-card` ha `border: 1px solid rgba(255,255,255,0.35)` -- nessun bordo colorato.

### 3. `src/components/AppSidebar.tsx` -- Conferma stato attivo

Lo stato attivo e gia corretto: `border-2 border-[#00C853] text-[#00C853]` su sfondo bianco (glass-icon-card). Nessuna modifica necessaria.

### 4. `src/components/MobileBottomNav.tsx` -- Stato attivo coerente

Aggiungere bordo verde all'icona attiva: da `bg-[#00C853]/10 shadow-sm` a `border-2 border-[#00C853]` sull'icona attiva, mantenendo sfondo bianco.

### 5. `src/components/ui/badge.tsx` -- Badge "Attivo/Inattivo"

Badge "Attivo" (variant default): usa `bg-primary` che e il verde corporate. OK ma intensificare: usare `bg-[#00C853]` direttamente.

Badge "Inattivo": usare rosso acceso `bg-destructive`.

## Riepilogo file

1. `src/index.css` -- `--destructive` piu acceso (rosso puro)
2. `src/pages/Employees.tsx` -- Card Sala/Cucina e employee rows uniformati a `glass-card`, pulsante invito con glass + bordo verde, colori verdi/rossi intensificati
3. `src/components/MobileBottomNav.tsx` -- Stato attivo con bordo verde
4. `src/components/ui/badge.tsx` -- Nessuna modifica strutturale (usa gia le CSS variables)

## Regola applicata ovunque

- **Stato attivo/cliccato**: sfondo bianco/glass + `border-2 border-[#00C853]`
- **Bordi card**: sempre neutri (`rgba(255,255,255,0.35)`), mai colorati
- **Tutte le inner card**: stesse proprietà `glass-card` (`white/88`, blur 10px, rounded 20px)
- **Verde**: `#00C853` (brillante)
- **Rosso**: `hsl(0, 100%, 50%)` (rosso puro intenso)

