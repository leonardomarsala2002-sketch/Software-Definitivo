import { useMemo } from "react";
import { Calendar, Sun, Scissors } from "lucide-react";
import { format, parseISO, startOfWeek, addDays } from "date-fns";
import { it } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ShiftRow } from "@/hooks/useShifts";

interface EmployeeWeekDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  employeeId: string;
  /** The date the user clicked — we show the week containing this date */
  referenceDate: string;
  /** All shifts for the store/month — we filter client-side */
  allShifts: ShiftRow[];
}

function isSplitDay(shifts: ShiftRow[]): boolean {
  const work = shifts.filter(s => !s.is_day_off && s.start_time && s.end_time);
  return work.length >= 2;
}

export function EmployeeWeekDrawer({
  open, onOpenChange, employeeName, employeeId, referenceDate, allShifts,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="text-base">{employeeName}</SheetTitle>
          <p className="text-xs text-muted-foreground">{weekLabel}</p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="px-5 py-4 space-y-2">
            {weekDates.map(dateStr => {
              const dayShifts = shiftsByDate.get(dateStr) ?? [];
              const isDayOff = dayShifts.some(s => s.is_day_off);
              const isSplit = isSplitDay(dayShifts);
              const d = parseISO(dateStr);
              const dayName = format(d, "EEEE", { locale: it });
              const dateLabel = format(d, "d MMMM", { locale: it });
              const isRef = dateStr === referenceDate;
              const hasShifts = dayShifts.length > 0;

              return (
                <Card
                  key={dateStr}
                  className={cn(
                    "p-4 transition-all",
                    isDayOff && "border-destructive/30 bg-destructive/5",
                    isSplit && !isDayOff && "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20",
                    isRef && "ring-2 ring-primary/30",
                    !hasShifts && !isDayOff && "opacity-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold capitalize text-foreground">
                          {dayName}
                        </span>
                        <span className="text-xs text-muted-foreground">{dateLabel}</span>
                        {isRef && (
                          <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">
                            Selezionato
                          </Badge>
                        )}
                        {dayShifts[0]?.status === "draft" && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-amber-600 border-amber-300">
                            Draft
                          </Badge>
                        )}
                      </div>

                      {isDayOff ? (
                        <div className="flex items-center gap-1.5 text-destructive">
                          <Sun className="h-4 w-4" />
                          <span className="text-sm font-medium">Giorno di riposo</span>
                        </div>
                      ) : hasShifts ? (
                        <div className="space-y-1">
                          {dayShifts.filter(s => !s.is_day_off).map(s => (
                            <div key={s.id} className="flex items-center gap-2">
                              <span className="text-base font-semibold text-foreground tabular-nums">
                                {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4 capitalize"
                              >
                                {s.department}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nessun turno</span>
                      )}
                    </div>

                    {isSplit && !isDayOff && (
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Scissors className="h-4 w-4" />
                        <span className="text-[10px] font-semibold">Spezzato</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
