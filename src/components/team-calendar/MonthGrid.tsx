import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ShiftRow } from "@/hooks/useShifts";

interface Employee {
  user_id: string;
  full_name: string | null;
}

interface MonthGridProps {
  year: number;
  month: number;
  shifts: ShiftRow[];
  employees: Employee[];
  department: "sala" | "cucina";
  selectedWeek: number | null; // null = all
  onDayClick: (date: string) => void;
}

const DOW_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  // getDay() 0=Sun, adjust to Mon=0
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getWeekOfDay(day: number, year: number, month: number): number {
  const cells = getMonthDays(year, month);
  const idx = cells.indexOf(day);
  return Math.floor(idx / 7);
}

function formatShiftTime(s: ShiftRow): string {
  if (s.is_day_off) return "OFF";
  const st = s.start_time?.slice(0, 5) ?? "";
  const et = s.end_time?.slice(0, 5) ?? "";
  return `${st}–${et}`;
}

export function MonthGrid({
  year,
  month,
  shifts,
  employees,
  department,
  selectedWeek,
  onDayClick,
}: MonthGridProps) {
  const cells = useMemo(() => getMonthDays(year, month), [year, month]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    shifts
      .filter((s) => s.department === department)
      .forEach((s) => {
        const existing = map.get(s.date) ?? [];
        existing.push(s);
        map.set(s.date, existing);
      });
    return map;
  }, [shifts, department]);

  const today = new Date();
  const todayStr =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? String(today.getDate())
      : null;

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-semibold text-muted-foreground py-1.5 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-px bg-border/50 rounded-lg overflow-hidden">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} className="bg-background min-h-[80px]" />;
          }

          const weekIdx = Math.floor(i / 7);
          const dimmed = selectedWeek !== null && weekIdx !== selectedWeek;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayShifts = shiftsByDate.get(dateStr) ?? [];
          const isToday = todayStr === String(day);

          return (
            <div
              key={day}
              className={cn(
                "bg-card min-h-[80px] p-1.5 cursor-pointer transition-all hover:bg-accent/40",
                dimmed && "opacity-40",
                isToday && "ring-1 ring-primary/40"
              )}
              onClick={() => onDayClick(dateStr)}
            >
              <div
                className={cn(
                  "text-xs font-medium mb-1",
                  isToday
                    ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    : "text-foreground"
                )}
              >
                {day}
              </div>
              <div className="space-y-0.5">
                {dayShifts.slice(0, 4).map((s) => {
                  const emp = employees.find((e) => e.user_id === s.user_id);
                  const name = emp?.full_name?.split(" ")[0] ?? "?";
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "text-[9px] leading-tight truncate rounded px-1 py-0.5",
                        s.is_day_off
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {name} {formatShiftTime(s)}
                    </div>
                  );
                })}
                {dayShifts.length > 4 && (
                  <div className="text-[9px] text-muted-foreground">
                    +{dayShifts.length - 4} altri
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
