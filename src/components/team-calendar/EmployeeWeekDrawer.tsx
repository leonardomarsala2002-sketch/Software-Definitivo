import { useMemo } from "react";
import { Sun, Scissors } from "lucide-react";
import { format, parseISO, startOfWeek, addDays } from "date-fns";
import { it } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getShiftColor, formatEndTime } from "@/lib/shiftColors";
import { cn } from "@/lib/utils";
import type { ShiftRow } from "@/hooks/useShifts";

interface EmployeeWeekDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  employeeId: string;
  referenceDate: string;
  allShifts: ShiftRow[];
  weeklyContractHours?: number;
}

const DAYS_FULL_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const TIMELINE_HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

function isSplitDay(shifts: ShiftRow[]): boolean {
  const work = shifts.filter(s => !s.is_day_off && s.start_time && s.end_time);
  return work.length >= 2;
}

export function EmployeeWeekDrawer({
  open, onOpenChange, employeeName, employeeId, referenceDate, allShifts, weeklyContractHours,
}: EmployeeWeekDrawerProps) {
  const weekDates = useMemo(() => {
    const ref = parseISO(referenceDate);
    const mon = startOfWeek(ref, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(mon, i), "yyyy-MM-dd"));
  }, [referenceDate]);

  const weekLabel = useMemo(() => {
    const s = parseISO(weekDates[0]);
    const e = parseISO(weekDates[6]);
    return `${format(s, "d MMM", { locale: it })} – ${format(e, "d MMM yyyy", { locale: it })}`;
  }, [weekDates]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    const empShifts = allShifts.filter(s => s.user_id === employeeId);
    empShifts.forEach(s => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [allShifts, employeeId]);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const totalWeekHours = useMemo(() => {
    let total = 0;
    for (const [, dayShifts] of shiftsByDate) {
      for (const s of dayShifts) {
        if (s.is_day_off || !s.start_time || !s.end_time) continue;
        const sh = parseInt(s.start_time.split(":")[0], 10);
        let eh = parseInt(s.end_time.split(":")[0], 10);
        if (eh === 0) eh = 24;
        total += eh - sh;
      }
    }
    return total;
  }, [shiftsByDate]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="w-full h-[70vh] rounded-t-[32px] p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="text-base">{employeeName}</SheetTitle>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{weekLabel}</p>
            {weeklyContractHours != null && (
              <Badge variant={totalWeekHours >= weeklyContractHours ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-4">
                {totalWeekHours}h / {weeklyContractHours}h
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(70vh-80px)]">
          <div className="px-5 py-4">
            {/* Timeline header */}
            <div className="flex mb-1">
              <div className="w-20 shrink-0" />
              <div className="flex-1 flex">
                {TIMELINE_HOURS.map((h) => (
                  <div key={h} className="text-[10px] text-muted-foreground font-medium text-center" style={{ width: `${100 / TIMELINE_HOURS.length}%` }}>
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
              </div>
            </div>

            {/* Week rows - same as dashboard timeline */}
            <div className="space-y-1">
              {weekDates.map((dateStr, i) => {
                const dayShifts = shiftsByDate.get(dateStr) ?? [];
                const isDayOff = dayShifts.some(s => s.is_day_off);
                const isSplit = isSplitDay(dayShifts);
                const d = parseISO(dateStr);
                const isDayToday = dateStr === today;
                const isRef = dateStr === referenceDate;

                return (
                  <div key={dateStr} className={cn("flex items-center min-h-[28px]", isRef && "ring-1 ring-primary/30 rounded-lg")}>
                    <div className={cn(
                      "w-20 shrink-0 pr-2 text-right text-xs font-medium",
                      isDayToday ? "text-primary font-semibold" : "text-muted-foreground"
                    )}>
                      <span className={isDayToday ? "bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-[11px]" : ""}>
                        {DAYS_FULL_IT[i].slice(0, 3)} {d.getDate()}
                      </span>
                    </div>

                    <div className="flex-1 relative h-6 bg-secondary rounded-lg overflow-hidden border border-border">
                      {TIMELINE_HOURS.map((h, hi) => (
                        <div key={h} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: `${(hi / TIMELINE_HOURS.length) * 100}%` }} />
                      ))}

                      {isDayOff ? (
                        <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-destructive">RIPOSO</span>
                        </div>
                      ) : (
                        dayShifts.filter(s => !s.is_day_off && s.start_time && s.end_time).map(s => {
                          const sH = parseInt(s.start_time!.split(":")[0]);
                          let eH = parseInt(s.end_time!.split(":")[0]);
                          if (eH === 0) eH = 24;
                          const totalSpan = TIMELINE_HOURS[TIMELINE_HOURS.length - 1] + 1 - TIMELINE_HOURS[0];
                          const left = ((sH - TIMELINE_HOURS[0]) / totalSpan) * 100;
                          const width = ((eH - sH) / totalSpan) * 100;
                          const color = getShiftColor(s);
                          return (
                            <div
                              key={s.id}
                              className={cn("absolute top-0.5 bottom-0.5 rounded-md border flex items-center justify-center", color.bg, color.border)}
                              style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}
                            >
                              <span className={cn("text-[10px] font-semibold", color.text)}>
                                {s.start_time?.slice(0, 5)}–{formatEndTime(s.end_time)}
                              </span>
                            </div>
                          );
                        })
                      )}

                      {isSplit && !isDayOff && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                          <Scissors className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
