import type { ShiftRow } from "@/hooks/useShifts";

/**
 * Restituisce le classi di colore per un turno in base all'orario.
 *
 * Regole (in ordine di priorità):
 * 1. Giorno di riposo → rosso (destructive)
 * 2. Ingresso 9, uscita 15 → blu (Mattina)
 * 3. Ingresso 11, uscita 15 → giallo (Pranzo)
 * 4. Uscita 19 (qualsiasi ingresso) → verde (Pomeriggio)
 * 5. Ingresso ≥ 19 (turni serali/notturni, incluse chiusure alle 24) → viola (Sera)
 * 6. Fallback → secondary/neutral
 */
export function getShiftColor(s: ShiftRow): {
  bg: string;
  border: string;
  text: string;
  label: string;
} {
  if (s.is_day_off) {
    return {
      bg: "bg-destructive/15",
      border: "border-destructive/30",
      text: "text-destructive",
      label: "Riposo",
    };
  }

  const startH = s.start_time ? parseInt(s.start_time.split(":")[0]) : -1;
  const endH = s.end_time ? parseInt(s.end_time.split(":")[0]) : -1;

  // Ingresso 9, uscita 15 → blu (Mattina)
  if (startH === 9 && endH === 15) {
    return {
      bg: "bg-shift-blue/20",
      border: "border-shift-blue/40",
      text: "text-shift-blue",
      label: "Mattina",
    };
  }

  // Ingresso 10, uscita 15 → blu chiaro (Mattina tarda)
  if (startH === 10 && endH === 15) {
    return {
      bg: "bg-shift-blue/20",
      border: "border-shift-blue/40",
      text: "text-shift-blue",
      label: "Mattina",
    };
  }

  // Ingresso 11, uscita 15 → giallo (Pranzo)
  if (startH === 11 && endH === 15) {
    return {
      bg: "bg-shift-yellow/20",
      border: "border-shift-yellow/40",
      text: "text-shift-yellow",
      label: "Pranzo",
    };
  }

  // Ingresso 12, uscita 15 → giallo (Pranzo breve)
  if (startH === 12 && endH === 15) {
    return {
      bg: "bg-shift-yellow/20",
      border: "border-shift-yellow/40",
      text: "text-shift-yellow",
      label: "Pranzo",
    };
  }

  // Uscita alle 19 (qualsiasi ingresso) → verde (Pomeriggio)
  if (endH === 19) {
    return {
      bg: "bg-shift-green/20",
      border: "border-shift-green/40",
      text: "text-shift-green",
      label: "Pomeriggio",
    };
  }

  // Ingresso ≥ 19 (sera/notte, incluse chiusure alle 24/00) → viola
  if (startH >= 19) {
    return {
      bg: "bg-shift-violet/20",
      border: "border-shift-violet/40",
      text: "text-shift-violet",
      label: "Sera",
    };
  }

  // Fallback
  return {
    bg: "bg-secondary",
    border: "border-border",
    text: "text-muted-foreground",
    label: "",
  };
}

/**
 * Formatta l'orario di fine turno per la visualizzazione.
 * Se l'orario è "00:00" lo mostra come "24:00" per chiarezza.
 */
export function formatEndTime(endTime: string | null): string {
  if (!endTime) return "";
  const display = endTime.slice(0, 5);
  return display === "00:00" ? "24:00" : display;
}
