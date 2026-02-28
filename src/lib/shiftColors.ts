import type { ShiftRow } from "@/hooks/useShifts";

/**
 * Restituisce le classi di colore per un turno in base all'orario.
 *
 * Regole:
 * - Ingresso 9, uscita 15 → blu
 * - Ingresso 11, uscita 15 → giallo
 * - Ingresso 19 (qualsiasi uscita) → verde
 * - Ingresso ≥ 19 (tutti gli altri) → viola
 * - Giorno di riposo → destructive (rosso)
 * - Fallback → secondary/neutral
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

  // Ingresso 9, uscita 15 → blu
  if (startH === 9 && endH === 15) {
    return {
      bg: "bg-shift-blue/20",
      border: "border-shift-blue/40",
      text: "text-shift-blue",
      label: "Mattina",
    };
  }

  // Ingresso 11, uscita 15 → giallo
  if (startH === 11 && endH === 15) {
    return {
      bg: "bg-shift-yellow/20",
      border: "border-shift-yellow/40",
      text: "text-shift-yellow",
      label: "Pranzo",
    };
  }

  // Ingresso esattamente 19 → verde
  if (startH === 19) {
    return {
      bg: "bg-shift-green/20",
      border: "border-shift-green/40",
      text: "text-shift-green",
      label: "Sera",
    };
  }

  // Ingresso ≥ 19 (20, 21, …) → viola
  if (startH >= 19) {
    return {
      bg: "bg-shift-violet/20",
      border: "border-shift-violet/40",
      text: "text-shift-violet",
      label: "Notte",
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
