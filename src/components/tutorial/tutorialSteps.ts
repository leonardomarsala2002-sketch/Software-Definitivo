import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface TutorialStep {
  /** CSS selector to highlight (optional – if omitted, centered modal) */
  selector?: string;
  /** Title shown in tooltip */
  title: string;
  /** Description */
  description: string;
  /** Optional route to navigate to before showing */
  route?: string;
}

/* ── Employee steps ─────────────────────────────────────────── */
const employeeSteps: TutorialStep[] = [
  {
    title: "Benvenuto! 👋",
    description:
      "Questa guida ti accompagnerà passo passo attraverso tutte le funzioni dell'app. Segui ogni step: evidenzieremo la parte dello schermo di cui parliamo. Puoi chiudere in qualsiasi momento con la X.",
  },

  // ── Sidebar icons ──
  {
    selector: '[data-tutorial="nav-dashboard"]',
    title: "📊 Dashboard – La tua panoramica",
    description:
      "Questa icona ti porta alla Dashboard. Qui trovi la timeline dei tuoi turni di oggi e della settimana, le ore lavorate, il bilancio ferie e i prossimi appuntamenti. È la prima cosa da controllare ogni giorno!",
    route: "/",
  },
  {
    selector: '[data-tutorial="nav-team-calendar"]',
    title: "📅 Calendario Team",
    description:
      "Questa icona apre il Calendario Team. Vedrai i turni di tutti i colleghi del tuo store, mese per mese. Clicca su un giorno per vedere chi lavora e in quale fascia oraria. Cliccando su un collega puoi vedere la sua settimana completa.",
    route: "/team-calendar",
  },
  {
    selector: '[data-tutorial="nav-requests"]',
    title: "📨 Richieste",
    description:
      "Da qui puoi inviare richieste al tuo admin: ferie, permessi, giorno libero, mattina/sera libera o cambio turno. Premi 'Nuova Richiesta', scegli il tipo, la data e aggiungi eventuali note. Vedrai lo stato aggiornato in tempo reale (in attesa, approvata, rifiutata).",
    route: "/requests",
  },
  {
    selector: '[data-tutorial="nav-messages"]',
    title: "💬 Messaggi",
    description:
      "L'icona messaggi ti permette di comunicare direttamente con gli admin del tuo store. Premi 'Nuova Conversazione', seleziona il destinatario e scrivi il tuo messaggio. Riceverai notifiche per le risposte.",
    route: "/messages",
  },

  // ── Key features ──
  {
    selector: '[data-tutorial="header-profile"]',
    title: "👤 Il tuo Profilo",
    description:
      "Cliccando sull'icona del profilo in alto a destra puoi vedere tutte le tue informazioni personali: nome, email, reparto, tipo di contratto, ore settimanali e store assegnato. È una vista di sola lettura.",
  },
  {
    selector: '[data-tutorial="nav-requests"]',
    title: "📝 Come inviare una richiesta – Esempio pratico",
    description:
      "1) Vai su Richieste (questa icona)\n2) Premi il bottone 'Nuova Richiesta'\n3) Scegli il tipo: Ferie, Permesso, Giorno Libero, Mattina/Sera Libera o Cambio Turno\n4) Seleziona la data e aggiungi note\n5) Premi 'Invia'. Il tuo admin riceverà una notifica!",
    route: "/requests",
  },
  {
    selector: '[data-tutorial="nav-team-calendar"]',
    title: "🔍 Come leggere il calendario",
    description:
      "Nel calendario, ogni cella del mese mostra i pallini colorati dei turni. I colori indicano la fascia oraria (mattina, pomeriggio, sera). Clicca su un giorno per vedere la lista dettagliata di chi lavora e quando. Se clicchi su un nome, vedrai la sua settimana intera con la timeline oraria.",
    route: "/team-calendar",
  },
  {
    title: "Tutorial completato! 🎉",
    description:
      "Ora conosci tutte le funzioni principali:\n• Dashboard per il riepilogo giornaliero\n• Calendario per vedere i turni del team\n• Richieste per ferie, permessi e cambi\n• Messaggi per comunicare con gli admin\n• Profilo per le tue informazioni\n\nBuon lavoro!",
  },
];

/* ── Admin steps ─────────────────────────────────────────── */
const adminSteps: TutorialStep[] = [
  {
    title: "Benvenuto Admin! 👋",
    description:
      "Questa guida ti mostrerà in dettaglio ogni funzione di gestione del tuo store. Evidenzieremo la parte dello schermo relativa a ciascun passaggio. Seguici!",
  },

  // ── Sidebar icons ──
  {
    selector: '[data-tutorial="nav-dashboard"]',
    title: "📊 Dashboard – Panoramica Store",
    description:
      "La Dashboard mostra il riepilogo operativo: dipendenti attivi, ore totali della settimana, richieste da approvare, copertura turni e appuntamenti. Controlla questa pagina ogni mattina per avere il polso della situazione.",
    route: "/",
  },
  {
    selector: '[data-tutorial="nav-team-calendar"]',
    title: "📅 Calendario Team – Gestione Turni",
    description:
      "Questo è il cuore dell'app. Qui visualizzi e gestisci i turni di tutto il team mese per mese. Puoi selezionare una settimana, generare i turni automaticamente, controllare il pannello 'Health Check' per problemi di copertura, e pubblicare i turni quando sono pronti.",
    route: "/team-calendar",
  },
  {
    selector: '[data-tutorial="nav-requests"]',
    title: "📨 Richieste – Approvazione/Rifiuto",
    description:
      "Qui arrivano le richieste dei dipendenti: ferie, permessi, cambi turno. Puoi approvare o rifiutare ciascuna con un click. Le richieste approvate vengono automaticamente considerate dal motore di generazione turni.",
    route: "/requests",
  },
  {
    selector: '[data-tutorial="nav-employees"]',
    title: "👥 Dipendenti – Anagrafica e Dettagli",
    description:
      "Consulta l'elenco completo dei dipendenti del tuo store. Clicca su un dipendente per vedere: dati personali, contratto, ore settimanali, reparto (sala/cucina), disponibilità settimanale e eccezioni (ferie, malattia). Puoi modificare la disponibilità da qui.",
    route: "/employees",
  },
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "⚙️ Impostazioni Store – Configurazione",
    description:
      "Questa è la sezione più importante per la generazione turni. Qui configuri 5 aree chiave:\n• Orari di apertura\n• Copertura minima per fascia oraria\n• Entrate/uscite consentite\n• Template turni\n• Regole del team (max ore, spezzati, giorni liberi)",
    route: "/store-settings",
  },
  {
    selector: '[data-tutorial="nav-messages"]',
    title: "💬 Messaggi",
    description:
      "Comunica con i dipendenti del tuo store, altri admin o il super admin. Premi 'Nuova Conversazione' per iniziare una chat. Le conversazioni sono private e solo tra i partecipanti.",
    route: "/messages",
  },

  // ── Deep-dive: Store Settings ──
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "🔧 Impostare le Regole – Passo 1: Orari Apertura",
    description:
      "Vai su Impostazioni Store e apri 'Orari di Apertura'. Per ogni giorno della settimana, imposta l'orario di apertura e chiusura del locale. Questi orari definiscono i limiti entro cui il motore può assegnare i turni.",
    route: "/store-settings",
  },
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "🔧 Passo 2: Copertura Minima",
    description:
      "Apri 'Copertura per Fascia Oraria'. Per ogni giorno e per ogni ora (es. 10:00, 11:00, 12:00...), imposta quante persone servono in sala e in cucina. Il motore genererà turni per coprire esattamente questo fabbisogno.",
    route: "/store-settings",
  },
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "🔧 Passo 3: Entrate e Uscite Consentite",
    description:
      "Apri 'Orari Entrata/Uscita Consentiti'. Definisci a che ora i dipendenti possono iniziare e finire il turno per sala e cucina. Esempio: entrata alle 10, 12 o 18; uscita alle 15, 19 o 00. Questo vincola il motore a generare turni con orari precisi.",
    route: "/store-settings",
  },
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "🔧 Passo 4: Regole del Team",
    description:
      "Apri 'Regole'. Qui configuri i limiti fondamentali:\n• Max ore giornaliere per dipendente (es. 8)\n• Max ore settimanali (es. 40)\n• Giorni liberi obbligatori (es. 1)\n• Max turni spezzati a settimana (es. 3)\n• Max ore giornaliere e settimanali per team sala/cucina\n• Toggle 'Generazione Automatica ogni Giovedì'",
    route: "/store-settings",
  },

  // ── Deep-dive: Shift Generation ──
  {
    selector: '[data-tutorial="nav-team-calendar"]',
    title: "🤖 Generare i Turni Automaticamente",
    description:
      "1) Vai al Calendario Team\n2) Seleziona la settimana da generare\n3) Premi 'Genera Turni'\n4) Il motore AI crea i turni rispettando tutte le regole, disponibilità e coperture\n5) I turni appaiono in stato 'bozza' — puoi controllarli prima di pubblicare",
    route: "/team-calendar",
  },
  {
    selector: '[data-tutorial="nav-team-calendar"]',
    title: "✅ Health Check e Suggerimenti",
    description:
      "Dopo la generazione, il pannello 'Health Check' mostra:\n• Slot non coperti (in rosso) con soluzioni alternative\n• Ottimizzazioni di equità (bilanciamento ore/spezzati)\n• Opportunità di prestito tra store\n\nPuoi accettare o rifiutare ogni suggerimento. Il sistema impara dalle tue scelte e proporrà soluzioni simili in futuro!",
    route: "/team-calendar",
  },
  {
    selector: '[data-tutorial="nav-team-calendar"]',
    title: "📤 Pubblicare i Turni",
    description:
      "Quando sei soddisfatto dei turni:\n1) Premi 'Pubblica Settimana'\n2) Tutti i turni passano da bozza a pubblicati\n3) I dipendenti ricevono automaticamente una notifica via email e in-app\n4) I turni pubblicati sono visibili nel calendario personale di ogni dipendente",
    route: "/team-calendar",
  },

  // ── Invitations ──
  {
    selector: '[data-tutorial="nav-employees"]',
    title: "📧 Invitare Nuovi Dipendenti",
    description:
      "Dalla sezione Dipendenti puoi invitare nuovi membri. Inserisci email, nome, reparto, tipo contratto e ore settimanali. L'invitato riceverà un'email con un link per creare il suo account e accedere direttamente all'app con il ruolo e lo store assegnati.",
    route: "/employees",
  },

  {
    title: "Tutorial completato! 🎉",
    description:
      "Ecco il riepilogo delle azioni chiave:\n1. Configura le Impostazioni Store (orari, copertura, regole)\n2. Invita i dipendenti\n3. Genera i turni dal Calendario Team\n4. Controlla il Health Check e gestisci i suggerimenti\n5. Pubblica i turni\n6. Gestisci richieste e comunica via Messaggi\n\nIl sistema impara dalle tue scelte settimana dopo settimana!",
  },
];

/* ── Super Admin steps ─────────────────────────────────────── */
const superAdminSteps: TutorialStep[] = [
  {
    title: "Benvenuto Super Admin! 👋",
    description:
      "Hai il controllo completo su tutti gli store della catena. Questa guida ti mostrerà ogni funzione disponibile, evidenziando la parte di schermo corrispondente.",
  },

  // ── Sidebar icons ──
  {
    selector: '[data-tutorial="nav-dashboard"]',
    title: "📊 Dashboard – Vista Globale",
    description:
      "La Dashboard mostra una panoramica aggregata di tutti gli store o di uno specifico. Usa lo switch 'Tutti i locali' per la vista globale: vedrai il totale dipendenti, ore, richieste pendenti e copertura turni su tutta la catena.",
    route: "/",
  },
  {
    selector: '[data-tutorial="store-switcher"]',
    title: "🏪 Selettore Store",
    description:
      "Dal menu nell'header puoi cambiare rapidamente lo store attivo. Tutto ciò che vedi (turni, dipendenti, impostazioni) si aggiorna in base allo store selezionato. Puoi anche creare e gestire nuovi store da qui.",
  },
  {
    selector: '[data-tutorial="nav-admin-shifts"]',
    title: "📅 Orari Admin – Turni per Store",
    description:
      "Questa vista ti permette di visualizzare i turni generati per ogni store e dipartimento (sala/cucina) senza entrare nel calendario completo. Utile per una verifica rapida cross-store.",
    route: "/admin-shifts",
  },
  {
    selector: '[data-tutorial="nav-employees"]',
    title: "👥 Dipendenti – Gestione Globale",
    description:
      "Gestisci l'anagrafica completa di tutti i dipendenti su tutti gli store. Puoi vedere dettagli contrattuali, disponibilità, eccezioni, e puoi invitare nuovi dipendenti o admin per qualsiasi store.",
    route: "/employees",
  },
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "⚙️ Impostazioni Store",
    description:
      "Configura regole, orari apertura, copertura e turni consentiti per lo store attivo. Seleziona lo store dall'header, poi configura qui. Le regole sono indipendenti per ogni store.",
    route: "/store-settings",
  },
  {
    selector: '[data-tutorial="nav-messages"]',
    title: "💬 Messaggi",
    description:
      "Comunica con gli admin di tutti gli store. Le conversazioni sono private. Puoi contattare qualsiasi admin della catena.",
    route: "/messages",
  },
  {
    selector: '[data-tutorial="nav-audit-log"]',
    title: "📋 Audit Log – Tracciabilità",
    description:
      "Il registro completo di tutte le azioni eseguite nell'app: generazioni turni, modifiche, approvazioni, login. Filtra per store, utente o periodo per una trasparenza totale.",
    route: "/audit-log",
  },

  // ── Deep-dive: Store management ──
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "🔧 Configurare un Nuovo Store – Step by Step",
    description:
      "Per ogni nuovo store:\n1) Crealo dal selettore store nell'header\n2) Vai su Impostazioni Store\n3) Configura: Orari di apertura → Copertura per fascia oraria → Entrate/uscite consentite → Regole del team\n4) Invita gli admin e i dipendenti\n5) Attiva la generazione automatica nelle Regole",
    route: "/store-settings",
  },
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "🔧 Regole e Generazione Automatica",
    description:
      "Nelle Regole puoi attivare il toggle 'Generazione Automatica ogni Giovedì'. Con questo attivo, ogni giovedì alle 03:00 il sistema genera automaticamente i turni per la settimana successiva. Puoi anche generare manualmente dal Calendario Team in qualsiasi momento.",
    route: "/store-settings",
  },

  // ── Cross-store features ──
  {
    selector: '[data-tutorial="nav-admin-shifts"]',
    title: "🔄 Prestiti tra Store",
    description:
      "Quando un store ha carenza di personale, il motore AI propone automaticamente prestiti da store vicini (stessa città). I suggerimenti appaiono nel Health Check. Entrambi gli admin (source e target) devono approvare il prestito.",
    route: "/admin-shifts",
  },
  {
    selector: '[data-tutorial="nav-employees"]',
    title: "📧 Invitare Admin e Dipendenti",
    description:
      "Dalla sezione Dipendenti puoi invitare:\n• Admin — che gestiranno uno o più store\n• Dipendenti — con tutti i dati anagrafici e contrattuali\n\nL'invitato riceve un'email, crea l'account e viene automaticamente assegnato allo store con il ruolo corretto.",
    route: "/employees",
  },

  {
    title: "Tutorial completato! 🎉",
    description:
      "Riepilogo azioni chiave:\n1. Crea/configura gli store (orari, copertura, regole)\n2. Invita admin e dipendenti\n3. Attiva la generazione automatica o genera manualmente\n4. Monitora dal Dashboard e Audit Log\n5. Gestisci prestiti cross-store\n6. Il sistema impara dalle tue scelte!\n\nHai il pieno controllo della catena. Buon lavoro!",
  },
];

export function getStepsForRole(role: AppRole): TutorialStep[] {
  switch (role) {
    case "super_admin":
      return superAdminSteps;
    case "admin":
      return adminSteps;
    case "employee":
      return employeeSteps;
    default:
      return employeeSteps;
  }
}
