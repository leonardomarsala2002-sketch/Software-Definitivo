

# Aggiungere margine interno di 14px al contenitore della griglia

## Problema
Attualmente il grid delle card nella dashboard non ha padding interno, quindi le card toccano i bordi del contenitore. L'utente vuole che lo sfondo grigio sia visibile come cornice attorno a tutte le card (sopra, a destra, a sinistra) con uno spazio uniforme di 14px.

## Soluzione

### File: `src/pages/Dashboard.tsx`

Aggiungere `p-3.5` (14px) al div contenitore della griglia principale (quello con `grid grid-cols-4`). Questo crea un margine interno uniforme di 14px su tutti i lati tra il bordo del contenitore e le card.

**Riga interessata:** la classe del div della griglia principale (attualmente `flex-1 grid grid-cols-4 grid-rows-[auto_1fr] gap-3.5 min-h-0 overflow-hidden`)

**Modifica:** aggiungere `p-3.5` alla lista delle classi, risultando in:
`flex-1 grid grid-cols-4 grid-rows-[auto_1fr] gap-3.5 p-3.5 min-h-0 overflow-hidden`

Questo garantisce 14px di padding interno su tutti e 4 i lati (top, right, bottom, left), coerente con il gap di 14px tra le card.

