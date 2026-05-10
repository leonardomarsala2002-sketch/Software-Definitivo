/**
 * Extracts the first valid JSON object or array from an AI response string.
 * The AI may wrap JSON in markdown code blocks — this handles that.
 */
export function extractJSON<T>(text: string): T {
  // Try to find ```json ... ``` block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  // Find the first { or [ to locate the start of the JSON
  const jsonStart = Math.min(
    candidate.indexOf("{") === -1 ? Infinity : candidate.indexOf("{"),
    candidate.indexOf("[") === -1 ? Infinity : candidate.indexOf("["),
  );

  if (jsonStart === Infinity) {
    throw new Error("No JSON found in AI response");
  }

  // Find matching closing bracket
  const startChar = candidate[jsonStart];
  const endChar = startChar === "{" ? "}" : "]";
  let depth = 0;
  let end = -1;

  for (let i = jsonStart; i < candidate.length; i++) {
    if (candidate[i] === startChar) depth++;
    else if (candidate[i] === endChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) throw new Error("Malformed JSON in AI response (unmatched brackets)");

  const jsonStr = candidate.slice(jsonStart, end + 1);
  return JSON.parse(jsonStr) as T;
}

/** Truncates a string to maxLength, appending "..." if truncated. */
export function truncate(s: string, maxLength: number): string {
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength - 3) + "...";
}

/** System prompt preamble shared by all schedule-generating features. */
export const SCHEDULE_SYSTEM_PREAMBLE = `Sei un assistente per la pianificazione turni di un negozio italiano.
Lavori SEMPRE in collaborazione con un rule engine deterministico che validerà la tua proposta.
Il tuo compito è generare turni ottimali rispettando le regole di business.

REGOLE INVIOLABILI (verranno verificate dal rule engine):
- Non assegnare turni lavorativi durante ferie/permessi/malattia approvati
- Rispetta le ore contrattuali di ogni dipendente (±tolleranza indicata)
- Il turno minimo è indicato nelle regole del negozio
- Non assegnare turni sovrapposti allo stesso dipendente nello stesso giorno
- Rispetta le coperture minime per reparto e fascia oraria

FORMATO RISPOSTA: rispondi SOLO con JSON valido, nessun testo aggiuntivo prima o dopo.`;
