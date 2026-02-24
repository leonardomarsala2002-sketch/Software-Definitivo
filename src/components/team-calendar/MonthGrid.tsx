import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ShiftRow } from "@/hooks/useShifts";

interface Employee {
  user_id: string;
  full_name: string | null;
}

interface EmployeeBalance {
  user_id: string;
  current_balance: number;
}

interface MonthGridProps {
  year: number;
  month: number;
  shifts: ShiftRow[];
  employees: Employee[];
  department: "sala" | "cucina";
  selectedWeek: number | null;
  onDayClick: (date: string) => void;
  uncoveredDates?: Map<string, Set<number>>;
  balances?: EmployeeBalance[];
  currentStoreId?: string;
  storeLookup?: Map<string, string>; // store_id → store name
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
  uncoveredDates,
  balances,
  currentStoreId,
  storeLookup,
}: MonthGridProps) {
  const today = new Date();
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

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

  const todayStrForHighlight =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? String(today.getDate())
      : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-7 gap-3 mb-1 flex-shrink-0">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-semibold text-white/40 py-1.5 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days - brick card grid with gap-3 (12px) */}
      <div className="grid grid-cols-7 gap-3 flex-1 auto-rows-fr">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} className="min-h-[60px]" />;
          }

          const weekIdx = Math.floor(i / 7);
          const dimmed = selectedWeek !== null && weekIdx !== selectedWeek;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayShifts = shiftsByDate.get(dateStr) ?? [];
          const isToday = todayStrForHighlight === String(day);
          const isUncovered = uncoveredDates?.has(dateStr);
          const hasDraft = dayShifts.some((s: any) => s.status === "draft");
          const isPast = dateStr < todayDateStr;
          const isArchived = dayShifts.length > 0 && dayShifts.every((s: any) => s.status === "archived");

          return (
            <div
              key={day}
              className={cn(
                "glass-card rounded-2xl p-1.5 cursor-pointer transition-all duration-200 hover:bg-white/10 hover:shadow-2xl hover:-translate-y-0.5 flex flex-col",
                dimmed && "opacity-40",
                isToday && "ring-2 ring-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.35)]",
                isUncovered && !isArchived && !isToday && "ring-1 ring-red-400/40",
                hasDraft && !isUncovered && !isArchived && !isToday && "ring-1 ring-amber-400/40",
                (isArchived || isPast) && !isToday && "opacity-60 grayscale-[50%]",
              )}
              onClick={() => onDayClick(dateStr)}
              title={isArchived ? "Questa settimana è archiviata e non può essere modificata." : undefined}
            >
              <div
                className={cn(
                  "text-xs font-medium mb-1",
                  isToday
                    ? "bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                    : "text-white/80"
                )}
              >
                {day}
              </div>
              <div className="space-y-0.5 flex-1 overflow-hidden">
                {dayShifts.slice(0, 4).map((s) => {
                  const emp = employees.find((e) => e.user_id === s.user_id);
                  const name = emp?.full_name?.split(" ")[0] ?? "?";
                  const bal = balances?.find(b => b.user_id === s.user_id);
                  const balLabel = bal && Math.abs(bal.current_balance) >= 1
                    ? `${bal.current_balance > 0 ? "+" : ""}${bal.current_balance}h`
                    : null;
                  const isLent = currentStoreId && s.store_id !== currentStoreId;
                  const lentFromName = isLent && storeLookup ? storeLookup.get(s.store_id) : null;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "text-[9px] leading-tight truncate rounded px-1 py-0.5 flex items-center gap-0.5",
                        s.is_day_off
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : s.status === "archived"
                            ? "bg-muted text-muted-foreground"
                            : s.status === "draft"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                      )}
                    >
                      <span className="truncate">{name} {formatShiftTime(s)}</span>
                      {isLent && (
                        <span className="text-[7px] font-bold shrink-0 px-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Prestito{lentFromName ? ` da ${lentFromName}` : ""}
                        </span>
                      )}
                      {balLabel && (
                        <span className={cn(
                          "text-[7px] font-bold shrink-0 px-0.5 rounded",
                          bal!.current_balance > 0
                            ? "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30"
                            : "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30"
                        )}>
                          {balLabel}
                        </span>
                      )}
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
