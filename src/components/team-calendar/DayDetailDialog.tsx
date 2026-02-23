import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ShiftRow } from "@/hooks/useShifts";
import type { OpeningHour } from "@/hooks/useStoreSettings";
import { ShiftEditPopover } from "./ShiftEditPopover";
import { EmployeeWeekDrawer } from "./EmployeeWeekDrawer";

interface Employee {
  user_id: string;
  full_name: string | null;
}

interface DayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  department: "sala" | "cucina";
  shifts: ShiftRow[];
  employees: Employee[];
  openingHours: OpeningHour[];
  allowedEntries: number[];
  allowedExits: number[];
  canEdit: boolean;
  onCreateShift: (shift: { user_id: string; date: string; start_time: string | null; end_time: string | null; is_day_off: boolean }) => void;
  onUpdateShift: (id: string, updates: Partial<Pick<ShiftRow, "start_time" | "end_time" | "is_day_off">>) => void;
  onDeleteShift: (id: string) => void;
}

function getShiftColor(s: ShiftRow): { bg: string; border: string; label?: string } {
  if (s.is_day_off) return { bg: "bg-destructive/15", border: "border-destructive/30" };
  const startH = s.start_time ? parseInt(s.start_time.split(":")[0]) : -1;
  const endH = s.end_time ? parseInt(s.end_time.split(":")[0]) : -1;

  if (startH === 9) return { bg: "bg-blue-500/20", border: "border-blue-500/40" };
  if (startH === 11) return { bg: "bg-orange-500/20", border: "border-orange-500/40" };
  if (startH === 19) return { bg: "bg-yellow-500/20", border: "border-yellow-500/40" };
  if (endH === 17 || endH === 19) return { bg: "bg-emerald-500/20", border: "border-emerald-500/40" };
  return { bg: "bg-muted", border: "border-border", label: "custom" };
}

export function DayDetailDialog({
  open, onOpenChange, date, department, shifts, employees,
  openingHours, allowedEntries, allowedExits, canEdit,
  onCreateShift, onUpdateShift, onDeleteShift,
}: DayDetailDialogProps) {
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [addingForUser, setAddingForUser] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Disable editing if all shifts for this date are archived
  const deptShiftsForDate = shifts.filter(s => s.department === department && s.date === date);
  const isArchived = deptShiftsForDate.length > 0 && deptShiftsForDate.every(s => s.status === "archived");
  const effectiveCanEdit = canEdit && !isArchived;

  const dayOfWeek = date ? (parseISO(date).getDay() + 6) % 7 : 0;
  const dayHours = openingHours.find((h) => h.day_of_week === dayOfWeek);
  const openH = dayHours ? parseInt(dayHours.opening_time.split(":")[0]) : 9;
  const closeH = dayHours ? parseInt(dayHours.closing_time.split(":")[0]) : 22;
  const effectiveClose = closeH === 0 ? 24 : closeH;

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = openH; h <= effectiveClose; h++) arr.push(h);
    return arr;
  }, [openH, effectiveClose]);

  const deptShifts = shifts.filter((s) => s.department === department && s.date === date);

  // Group shifts by user
  const userShifts = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    deptShifts.forEach((s) => {
      const arr = map.get(s.user_id) ?? [];
      arr.push(s);
      map.set(s.user_id, arr);
    });
    return map;
  }, [deptShifts]);

  const dateLabel = date ? format(parseISO(date), "EEEE d MMMM yyyy", { locale: it }) : "";
  const totalSpan = effectiveClose - openH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0 rounded-[32px]">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="capitalize text-base">{dateLabel}</DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="w-fit text-xs capitalize">{department}</Badge>
            {isArchived && (
              <Badge variant="secondary" className="w-fit text-xs">
                Archiviato — sola lettura
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-80px)]">
          <div className="px-6 py-4">
            {/* Timeline header */}
            <div className="flex mb-1">
              <div className="w-32 shrink-0" />
              <div className="flex-1 flex">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="text-[10px] text-muted-foreground font-medium text-center"
                    style={{ width: `${100 / hours.length}%` }}
                  >
                    {String(h === 24 ? 0 : h).padStart(2, "0")}
                  </div>
                ))}
              </div>
              {/* Read-only view */}
            </div>

            {/* Grid lines */}
            <div className="space-y-1">
              {employees.map((emp) => {
                const empShifts = userShifts.get(emp.user_id) ?? [];
                const isDayOff = empShifts.some((s) => s.is_day_off);
                const name = emp.full_name ?? "—";

                return (
                  <div key={emp.user_id} className="flex items-center group min-h-[36px]">
                    {/* Name */}
                    <div className="w-32 shrink-0 pr-2">
                      <button
                        type="button"
                        className={cn(
                          "text-xs font-medium text-foreground truncate block text-left w-full",
                          canEdit && "hover:text-primary hover:underline cursor-pointer"
                        )}
                        onClick={() => canEdit && setSelectedEmployee(emp)}
                        disabled={!canEdit}
                      >
                        {name}
                      </button>
                    </div>

                    {/* Timeline bar area */}
                    <div className="flex-1 relative h-8 bg-muted/30 rounded-md overflow-hidden border border-border/40">
                      {/* Hour grid lines */}
                      {hours.map((h, i) => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-l border-border/20"
                          style={{ left: `${(i / hours.length) * 100}%` }}
                        />
                      ))}

                      {isDayOff ? (
                        <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-destructive">RIPOSO</span>
                        </div>
                      ) : (
                        empShifts
                          .filter((s) => !s.is_day_off && s.start_time && s.end_time)
                          .map((s) => {
                            const sH = parseInt(s.start_time!.split(":")[0]);
                            let eH = parseInt(s.end_time!.split(":")[0]);
                            if (eH === 0) eH = 24;
                            const left = ((sH - openH) / totalSpan) * 100;
                            const width = ((eH - sH) / totalSpan) * 100;
                            const color = getShiftColor(s);

                            return (
                              <div
                                key={s.id}
                                className={cn(
                                  "absolute top-0.5 bottom-0.5 rounded border flex items-center justify-center",
                                  color.bg,
                                  color.border
                                )}
                                style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100, width)}%` }}
                              >
                                <span className="text-[10px] font-semibold text-foreground/80">
                                  {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                                </span>
                                {color.label && (
                                  <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 h-3">
                                    {color.label}
                                  </Badge>
                                )}
                              </div>
                            );
                          })
                      )}
                    </div>

                    {/* Actions removed - shifts are managed only via AI suggestions */}
                  </div>
                );
              })}
            </div>

            {employees.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessun dipendente nel reparto {department}
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Employee week drawer */}
        {selectedEmployee && (
          <EmployeeWeekDrawer
            open={!!selectedEmployee}
            onOpenChange={(v) => !v && setSelectedEmployee(null)}
            employeeName={selectedEmployee.full_name ?? "—"}
            employeeId={selectedEmployee.user_id}
            referenceDate={date}
            allShifts={shifts}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
