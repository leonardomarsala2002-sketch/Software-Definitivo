/**
 * Generates an iCalendar (.ics) file from shift data.
 * Compatible with Google Calendar, Apple Calendar, Outlook.
 */

interface IcsShift {
  id: string;
  date: string;          // yyyy-MM-dd
  start_time: string | null;  // HH:mm:ss
  end_time: string | null;
  department: "sala" | "cucina";
  is_day_off: boolean;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Convert "2026-03-02" + "09:00:00" → "20260302T090000" */
function toIcsDateTime(date: string, time: string): string {
  const [y, m, d] = date.split("-");
  const [h, mi, s] = (time ?? "00:00:00").split(":");
  return `${y}${m}${d}T${h}${mi}${s ?? "00"}`;
}

/** Convert "2026-03-02" → "20260302" (all-day) */
function toIcsDate(date: string): string {
  return date.replace(/-/g, "");
}

function escapeText(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

export function generateIcsContent(
  shifts: IcsShift[],
  calendarName = "I Miei Turni"
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ShiftWise//Turni//IT",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const shift of shifts) {
    const uid = `${shift.id}@shiftwisechef`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toIcsDateTime(new Date().toISOString().slice(0, 10), new Date().toISOString().slice(11, 19))}`);

    if (shift.is_day_off) {
      // All-day event for day off
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(shift.date)}`);
      // iCal all-day end is exclusive (next day)
      const d = new Date(shift.date);
      d.setDate(d.getDate() + 1);
      const nextDay = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      lines.push(`DTEND;VALUE=DATE:${nextDay}`);
      lines.push(`SUMMARY:🌞 Giorno di riposo`);
    } else if (shift.start_time && shift.end_time) {
      lines.push(`DTSTART:${toIcsDateTime(shift.date, shift.start_time)}`);
      lines.push(`DTEND:${toIcsDateTime(shift.date, shift.end_time)}`);
      const dept = shift.department === "sala" ? "Sala" : "Cucina";
      const start = shift.start_time.slice(0, 5);
      const end = shift.end_time.slice(0, 5);
      lines.push(`SUMMARY:Turno ${dept} ${start}–${end}`);
      lines.push(`DESCRIPTION:Reparto: ${dept}\\nOrario: ${start} – ${end}`);
    }

    lines.push(`CATEGORIES:Turni`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcsFile(content: string, filename = "turni.ics") {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
