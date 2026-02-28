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
      "Questa guida ti mostrerà le funzioni principali dell'app in pochi passi. Puoi chiuderla in qualsiasi momento.",
  },
  {
    selector: '[data-tutorial="nav-dashboard"]',
    title: "Dashboard",
    description:
      "La dashboard mostra un riepilogo dei tuoi turni della settimana, ore lavorate e prossimi appuntamenti.",
    route: "/",
  },
  {
    selector: '[data-tutorial="nav-team-calendar"]',
    title: "Calendario Team",
    description:
      "Qui puoi visualizzare i turni di tutto il team, giorno per giorno. Clicca su un giorno per i dettagli.",
    route: "/team-calendar",
  },
  {
    selector: '[data-tutorial="nav-requests"]',
    title: "Richieste",
    description:
      "Invia richieste di ferie, permessi o cambi turno. Vedrai lo stato di ogni richiesta (in attesa, approvata, rifiutata).",
    route: "/requests",
  },
  {
    selector: '[data-tutorial="nav-messages"]',
    title: "Messaggi",
    description:
      "Usa la messaggistica per comunicare con gli admin del tuo store.",
    route: "/messages",
  },
  {
    selector: '[data-tutorial="header-profile"]',
    title: "Il tuo profilo",
    description:
      "Cliccando sull'icona profilo puoi vedere le tue informazioni personali, contratto e store assegnato.",
  },
  {
    title: "Tutorial completato! 🎉",
    description:
      "Ora conosci le funzioni principali. Buon lavoro!",
  },
];

/* ── Admin steps ─────────────────────────────────────────── */
const adminSteps: TutorialStep[] = [
  {
    title: "Benvenuto Admin! 👋",
    description:
      "Ti guideremo attraverso tutte le funzioni di gestione del tuo store.",
  },
  {
    selector: '[data-tutorial="nav-dashboard"]',
    title: "Dashboard",
    description:
      "Panoramica completa: dipendenti attivi, ore settimanali, richieste pendenti e copertura turni.",
    route: "/",
  },
  {
    selector: '[data-tutorial="nav-team-calendar"]',
    title: "Calendario Team",
    description:
      "Visualizza e gestisci i turni del team. Puoi cliccare su un giorno per i dettagli e su un dipendente per la sua settimana.",
    route: "/team-calendar",
  },
  {
    selector: '[data-tutorial="nav-requests"]',
    title: "Richieste",
    description:
      "Gestisci le richieste dei dipendenti (ferie, permessi, cambi turno). Puoi anche creare richieste per te stesso con auto-approvazione.",
    route: "/requests",
  },
  {
    selector: '[data-tutorial="nav-employees"]',
    title: "Dipendenti",
    description:
      "Consulta l'elenco completo dei dipendenti del tuo store con i dettagli contrattuali e disponibilità.",
    route: "/employees",
  },
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "Impostazioni Store ⚙️",
    description:
      "Configura le regole operative: orari di apertura, copertura minima per fascia oraria, entrate/uscite consentite e limiti del team. Questo è fondamentale per la generazione automatica dei turni.",
    route: "/store-settings",
  },
  {
    selector: '[data-tutorial="nav-messages"]',
    title: "Messaggi",
    description:
      "Comunica con i dipendenti del tuo store, altri admin o il super admin.",
    route: "/messages",
  },
  {
    title: "Tutorial completato! 🎉",
    description:
      "Ora conosci tutte le funzioni. Inizia configurando le Impostazioni Store per abilitare la generazione turni!",
  },
];

/* ── Super Admin steps ─────────────────────────────────────── */
const superAdminSteps: TutorialStep[] = [
  {
    title: "Benvenuto Super Admin! 👋",
    description:
      "Hai il controllo completo su tutti gli store. Ecco una panoramica delle funzioni disponibili.",
  },
  {
    selector: '[data-tutorial="nav-dashboard"]',
    title: "Dashboard",
    description:
      "Panoramica globale o per singolo store. Usa lo switch 'Tutti i locali' per la vista aggregata.",
    route: "/",
  },
  {
    selector: '[data-tutorial="store-switcher"]',
    title: "Selettore Store",
    description:
      "Cambia rapidamente lo store attivo dal menu nell'header. Puoi anche aggiungere nuovi store.",
  },
  {
    selector: '[data-tutorial="nav-admin-shifts"]',
    title: "Orari Admin",
    description:
      "Visualizza i turni generati per ogni store e dipartimento (sala/cucina).",
    route: "/admin-shifts",
  },
  {
    selector: '[data-tutorial="nav-employees"]',
    title: "Dipendenti",
    description:
      "Gestisci l'anagrafica completa di tutti i dipendenti su tutti gli store.",
    route: "/employees",
  },
  {
    selector: '[data-tutorial="nav-store-settings"]',
    title: "Impostazioni Store",
    description:
      "Configura regole, orari apertura, copertura e turni consentiti per ogni store. Fondamentale per la generazione automatica.",
    route: "/store-settings",
  },
  {
    selector: '[data-tutorial="nav-audit-log"]',
    title: "Audit Log",
    description:
      "Registro completo di tutte le azioni eseguite nell'app per trasparenza e tracciabilità.",
    route: "/audit-log",
  },
  {
    selector: '[data-tutorial="nav-messages"]',
    title: "Messaggi",
    description:
      "Comunica con gli admin di tutti gli store.",
    route: "/messages",
  },
  {
    title: "Tutorial completato! 🎉",
    description:
      "Hai il pieno controllo. Inizia gestendo gli store e configurando le regole per la generazione automatica turni!",
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
