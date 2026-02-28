

## Analisi: come trasformare la UI in stile SaaS premium (riferimento screenshot)

Lo screenshot mostra un design **dark-mode premium** con queste caratteristiche chiave:
- Sfondo scuro caldo (non nero puro, ma toni ~#1a1a1a / #222)
- Card con bordi arrotondati, sfondo leggermente più chiaro del bg (~#2a2a2a)
- Accent color verde/dorato per highlights e KPI
- Tipografia pulita, gerarchica, con numeri grandi per le metriche
- Header con search bar, notifiche, avatar utente
- Sidebar iconica minimalista (già simile alla vostra)
- KPI cards in riga orizzontale con trend e percentuali
- Grafici integrati nelle card (area charts, donut)

---

## Cosa chiedermi — lista di prompt consigliati

Ecco i prompt da inviarmi, **uno alla volta**, per trasformare progressivamente l'UI:

### 1. Tema e colori (fondamentale, da fare per primo)
> "Trasforma il tema dell'app in dark mode permanente ispirato allo screenshot di riferimento: sfondo scuro caldo (#1C1C1E), card con sfondo #2A2A2C, bordi sottili rgba(255,255,255,0.08), testo chiaro. Accent verde #00C853 mantenuto. Rimuovi il glassmorphism e lo sfondo immagine bg-green-abstract.png. Font: Inter o SF Pro."

### 2. Layout sidebar + header
> "Ridisegna l'header globale dell'app con: logo a sinistra, barra di ricerca centrale, icone notifiche + avatar utente a destra. Mantieni la sidebar iconica a sinistra ma con stile dark (icone chiare su sfondo scuro). Aggiungi un breadcrumb o titolo pagina nell'header."

### 3. Dashboard — KPI cards orizzontali
> "Ridisegna la Dashboard con una riga di 4-5 KPI card orizzontali in alto (es: Dipendenti attivi, Ore settimanali, Turni scoperti, Richieste pendenti, Tasso copertura). Ogni card mostra valore grande, trend percentuale con freccia verde/rossa, e periodo di riferimento. Stile dark come da riferimento."

### 4. Dashboard — grafici e widget
> "Sotto le KPI cards, aggiungi una griglia di widget: un grafico ad area 'Ore lavorate per settimana' (ultime 8 settimane), un donut chart 'Distribuzione sala/cucina', e una tabella compatta 'Ultime richieste'. Usa recharts con tema dark e colori coerenti."

### 5. Card e componenti globali
> "Aggiorna lo stile di tutte le card dell'app (Dialog, Popover, DropdownMenu, Sheet, tabelle) al nuovo tema dark: sfondo #2A2A2C, bordi sottili semi-trasparenti, ombre morbide scure, border-radius 16px. Niente glassmorphism."

### 6. Calendario e tabelle
> "Ridisegna il Team Calendar e il calendario mensile in stile dark: celle con sfondo #2A2A2C, bordi grid sottili, turni colorati con badge compatti, header giorno/ora leggibile su sfondo scuro."

### 7. Form e input
> "Aggiorna tutti gli input, select, checkbox, switch al tema dark: sfondo input #333, bordi #444, testo chiaro, focus ring verde #00C853. Bottoni primari con gradiente verde, bottoni secondari con bordo sottile."

### 8. Mobile responsive
> "Verifica e ottimizza il layout mobile con il nuovo tema dark: bottom nav scura, card impilate verticalmente, KPI cards scrollabili orizzontalmente, touch target adeguati."

---

### Ordine consigliato
Segui l'ordine 1→8. Il punto 1 è il fondamento: senza cambiare tema e colori, tutto il resto non ha senso. Ogni prompt successivo si costruisce sul precedente.

### Note tecniche
- Il progetto attuale usa glassmorphism + sfondo immagine + light theme. La trasformazione richiede riscrivere le CSS variables in `index.css`, rimuovere le classi `.glass-*`, e aggiornare le card in ogni pagina.
- La sidebar iconica attuale è già vicina al riferimento, serve solo il restyle colori.
- I componenti shadcn/ui si adattano automaticamente alle CSS variables, quindi cambiando `:root` si aggiorna quasi tutto.

