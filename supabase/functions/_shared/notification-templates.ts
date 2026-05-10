// Template notifiche centralizzati per tutti i canali (in-app, email, WhatsApp).
// Usare queste funzioni per garantire messaggi consistenti in tutte le Edge Functions.

export type NotificationType =
  | "shift_published"
  | "shift_modified"
  | "time_off_approved"
  | "time_off_rejected"
  | "time_off_submitted"
  | "illness_submitted"
  | "illness_approved"
  | "illness_rejected"
  | "lending_request"
  | "lending_approved"
  | "lending_rejected"
  | "schedule_generated";

export interface NotificationTemplate {
  title: string;
  body: string;
}

// ─── Template per tipo ────────────────────────────────────────────────────────

export function getTemplate(
  type: NotificationType,
  params: Record<string, string> = {},
): NotificationTemplate {
  const t = TEMPLATES[type];
  if (!t) return { title: type, body: params.detail ?? "" };

  const fill = (str: string) =>
    str.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);

  return { title: fill(t.title), body: fill(t.body) };
}

const TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  shift_published: {
    title: "Turni pubblicati per la settimana del {week}",
    body:  "I turni della settimana del {week} sono stati pubblicati. Accedi all'app per visualizzarli.",
  },
  shift_modified: {
    title: "Turno modificato — {date}",
    body:  "Il tuo turno del {date} è stato modificato: {start_time}–{end_time}. Accedi per i dettagli.",
  },
  time_off_approved: {
    title: "Richiesta approvata — {date}",
    body:  "La tua richiesta di {type} per il {date} è stata approvata.",
  },
  time_off_rejected: {
    title: "Richiesta non approvata — {date}",
    body:  "La tua richiesta di {type} per il {date} non è stata approvata. Motivo: {reason}.",
  },
  time_off_submitted: {
    title: "Nuova richiesta da {employee}",
    body:  "{employee} ha inviato una richiesta di {type} per il {date}.",
  },
  illness_submitted: {
    title: "Malattia comunicata — {employee}",
    body:  "{employee} ha comunicato malattia dal {start_date} al {end_date}.",
  },
  illness_approved: {
    title: "Certificato malattia approvato",
    body:  "Il tuo certificato di malattia dal {start_date} al {end_date} è stato approvato.",
  },
  illness_rejected: {
    title: "Certificato malattia non accettato",
    body:  "Il certificato di malattia dal {start_date} al {end_date} non è stato accettato. Motivo: {reason}.",
  },
  lending_request: {
    title: "Richiesta prestito dipendente da {store}",
    body:  "Il negozio {store} richiede il prestito di {employee} per il {date}.",
  },
  lending_approved: {
    title: "Prestito dipendente approvato",
    body:  "Il prestito di {employee} per il {date} è stato approvato dal negozio {store}.",
  },
  lending_rejected: {
    title: "Prestito dipendente non approvato",
    body:  "Il prestito di {employee} per il {date} non è stato approvato.",
  },
  schedule_generated: {
    title: "Turni generati — settimana del {week}",
    body:  "La generazione automatica dei turni per la settimana del {week} è completata. Quality score: {score}/100.",
  },
};
