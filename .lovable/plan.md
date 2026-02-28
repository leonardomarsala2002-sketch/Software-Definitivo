

## Problema

L'edge function `generate-optimized-schedule` non si avvia a causa di un errore di sintassi:

```
Identifier 'dow' has already been declared
```

Nella funzione `findCorrectionAlternatives` (riga 1069), la variabile `const dow` viene dichiarata due volte:
- Riga 1072: `const dow = getDayOfWeek(dateStr);`
- Riga 1216: `const dow = getDayOfWeek(dateStr);` (duplicata)

Essendo nello stesso scope della stessa funzione, Deno strict mode blocca il boot.

## Piano

1. **Fix in `supabase/functions/generate-optimized-schedule/index.ts`**: Alla riga 1216, sostituire `const dow = getDayOfWeek(dateStr);` con un semplice commento o rimuoverla, dato che `dow` è già definita alla riga 1072 con lo stesso valore (stessa `dateStr`).
2. **Deploy** della edge function per verificare che il boot error sia risolto.

## Dettaglio tecnico

La variabile `dow` alla riga 1072 è già disponibile in tutto il corpo di `findCorrectionAlternatives`. La seconda dichiarazione alla riga 1216 è ridondante e causa il crash. Basta rimuoverla e usare la variabile già esistente.

