import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ArrowRightLeft } from "lucide-react";
import type { ShiftRow } from "@/hooks/useShifts";
import type { LendingRecord } from "@/hooks/useLendingData";

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
  storeLookup?: Map<string, string>;
  totalWeeks?: number;
  lendings?: LendingRecord[];
}

const DOW_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
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
  totalWeeks = 5,
  lendings = [],
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

  const maxVisibleShifts = totalWeeks >= 6 ? 1 : totalWeeks >= 5 ? 2 : 4;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-7 gap-1 mb-0.5 flex-shrink-0 px-1">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold text-muted-foreground py-1.5 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr px-1 pb-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} />;
          }

          const weekIdx = Math.floor(i / 7);
          const dimmed = selectedWeek !== null && weekIdx !== selectedWeek;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayShifts = shiftsByDate.get(dateStr) ?? [];
          const dayLendings = lendings.filter(l => l.suggested_date === dateStr && l.department === department);
          const isToday = todayStrForHighlight === String(day);
          const isUncovered = uncoveredDates?.has(dateStr);
          const hasDraft = dayShifts.some((s: any) => s.status === "draft");
          const isPast = dateStr < todayDateStr;
          const isArchived = dayShifts.length > 0 && dayShifts.every((s: any) => s.status === "archived");

          return (
            <div
              key={day}
              className={cn(
                "rounded-xl border border-border/60 bg-secondary p-1 cursor-pointer transition-all duration-150 ease-in-out hover:border-primary/40 hover:bg-accent flex flex-col overflow-hidden min-h-0",
                dimmed && "opacity-40",
                isToday && "ring-2 ring-primary border-primary/50 shadow-[0_0_12px_hsl(152_100%_40%/0.25)]",
                isUncovered && !isArchived && !isToday && "ring-1 ring-destructive/50 border-destructive/30",
                hasDraft && !isUncovered && !isArchived && !isToday && "ring-1 ring-warning/50 border-warning/30",
                (isArchived || isPast) && !isToday && "opacity-50",
              )}
              onClick={() => onDayClick(dateStr)}
              title={isArchived ? "Questa settimana è archiviata e non può essere modificata." : undefined}
            >
              <div
                className={cn(
                  "text-[10px] font-medium mb-0.5 leading-none",
                  isToday
                    ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    : "text-foreground/80 font-medium"
                )}
              >
                {day}
              </div>
              <div className="space-y-px flex-1 overflow-hidden min-h-0">
                {dayShifts.slice(0, maxVisibleShifts).map((s) => {
                  const emp = employees.find((e) => e.user_id === s.user_id);
                  const name = emp?.full_name?.split(" ")[0] ?? "?";
                  const isLent = currentStoreId && s.store_id !== currentStoreId;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "text-[8px] leading-tight truncate rounded-md px-1 py-px font-medium",
                        s.is_day_off
                          ? "bg-destructive/15 text-destructive"
                          : s.status === "archived"
                            ? "bg-muted/60 text-muted-foreground"
                            : s.status === "draft"
                              ? "bg-warning/15 text-warning"
                              : "bg-primary/15 text-primary"
                      )}
                    >
                      <span className="truncate">{name} {formatShiftTime(s)}</span>
                      {isLent && (
                        <span className="text-[7px] font-bold shrink-0 px-0.5 rounded bg-primary/20 text-primary ml-0.5">
                          P
                        </span>
                      )}
                    </div>
                  );
                })}
                {dayShifts.length > maxVisibleShifts && totalWeeks <= 5 && (
                  <div className="text-[8px] text-muted-foreground leading-tight">
                    +{dayShifts.length - maxVisibleShifts}
                  </div>
                )}
                {dayLendings.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-px">
                    <ArrowRightLeft className="h-2.5 w-2.5 text-chart-4" />
                    <span className="text-[7px] font-bold text-chart-4">{dayLendings.length} prestito</span>
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
