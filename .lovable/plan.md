

## Analisi del problema

Dalle screenshot:
- **Alessandro Giordano**: 2 giorni liberi (Mar 3, Sab 7)
- **Davide Fontana**: 1 giorno libero (Gio 5)

Il pre-planning assegna correttamente 1 giorno libero ciascuno (riga 1158-1159). Il problema nasce **dopo**, durante `autoCorrectViolations` (riga ~720-722): quando un dipendente supera le ore settimanali, il turno viene convertito in giorno libero (`is_day_off: true`), creando un **secondo riposo non pianificato** che rompe l'equità.

`equalizeEquity` tenta di riparare tramite swap, ma fallisce perché le condizioni di copertura sono troppo restrittive (non trova un giorno dove togliere il riposo al donor senza scoprire slot).

## Piano di correzione

### 1. `autoCorrectViolations` — Non creare giorni liberi extra

Quando si rimuove un turno per eccesso ore, **eliminare** lo shift (non convertirlo in `is_day_off: true`). Il giorno resta semplicemente senza turno per quel dipendente. Il sistema assegnerà il day-off marker solo nel post-processing finale, dopo che l'equità è stata verificata.

### 2. `equalizeEquity` — Fallback forzato

Se dopo 5 passaggi di swap i giorni liberi non sono uguali, aggiungere un **fallback forzato**: rimuovere i giorni liberi in eccesso dai donor (convertendoli in giorni lavorativi con un turno minimo template) anche se la copertura è già soddisfatta. L'equità è prioritaria rispetto all'ottimizzazione ore.

### 3. Post-processing finale — Assegnazione uniforme day-off

Dopo tutte le correzioni e l'equità, ricalcolare i giorni senza turno per ogni dipendente standard e assicurarsi che il conteggio `is_day_off` sia identico, rimuovendo marker day-off in eccesso o aggiungendoli dove mancano.

