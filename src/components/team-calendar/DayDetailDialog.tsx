import { useState, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowRightLeft, Sparkles, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatEndTime } from "@/lib/shiftColors";
import { getShiftColor } from "@/lib/shiftColors";
import type { ShiftRow } from "@/hooks/useShifts";
import type { OpeningHour } from "@/hooks/useStoreSettings";
import type { LendingRecord } from "@/hooks/useLendingData";
import { DraggableShiftBar } from "./DraggableShiftBar";
import { EmployeeWeekDrawer } from "./EmployeeWeekDrawer";

interface Employee {
  user_id: string;
  full_name: string | null;
  weekly_contract_hours?: number;
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
  lendings?: LendingRecord[];
  currentStoreId?: string;
  onCreateShift: (shift: { user_id: string; date: string; start_time: string | null; end_time: string | null; is_day_off: boolean }) => void;
  onUpdateShift: (id: string, updates: Partial<Pick<ShiftRow, "start_time" | "end_time" | "is_day_off">>) => void;
  onDeleteShift: (id: string) => void;
  onRebalanceAfterEdit?: () => void;
  isRebalancing?: boolean;
}


export function DayDetailDialog({
  open, onOpenChange, date, department, shifts, employees,
  openingHours, allowedEntries, allowedExits, canEdit,
  lendings = [], currentStoreId,
  onCreateShift, onUpdateShift, onDeleteShift,
  onRebalanceAfterEdit, isRebalancing,
}: DayDetailDialogProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pendingManualEdits, setPendingManualEdits] = useState<Map<string, { start_time?: string; end_time?: string }>>(new Map());

  const deptShiftsForDate = shifts.filter(s => s.department === department && s.date === date);
  const isArchived = deptShiftsForDate.length > 0 && deptShiftsForDate.every(s => s.status === "archived");

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

  const userShifts = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    deptShifts.forEach((s) => {
      const arr = map.get(s.user_id) ?? [];
      arr.push(s);
      map.set(s.user_id, arr);
    });
    return map;
  }, [deptShifts]);

  const handleDragUpdate = useCallback((id: string, updates: { start_time?: string; end_time?: string }) => {
    // Apply the shift change immediately
    onUpdateShift(id, updates);
    // Track that a manual edit happened
    setPendingManualEdits(prev => {
      const next = new Map(prev);
      next.set(id, updates);
      return next;
    });
  }, [onUpdateShift]);

  const handleConfirmRebalance = useCallback(() => {
    if (onRebalanceAfterEdit) {
      onRebalanceAfterEdit();
      setPendingManualEdits(new Map());
    }
  }, [onRebalanceAfterEdit]);

  const dateLabel = date ? format(parseISO(date), "EEEE d MMMM yyyy", { locale: it }) : "";
  const totalSpan = effectiveClose - openH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0 rounded-2xl border-border bg-card">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle className="capitalize text-base text-foreground">{dateLabel}</DialogTitle>
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
            {/* Rebalance banner */}
            {pendingManualEdits.size > 0 && canEdit && onRebalanceAfterEdit && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-primary font-medium flex-1">
                  <strong>{pendingManualEdits.size}</strong> turno/i modificato/i manualmente. Rigenera con AI per ribilanciare gli altri dipendenti.
                </span>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-[11px] px-3 gap-1.5 rounded-[32px]"
                  onClick={handleConfirmRebalance}
                  disabled={isRebalancing}
                >
                  {isRebalancing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Ribilancia AI
                </Button>
              </div>
            )}

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
            </div>

            {/* Grid lines */}
            <div className="space-y-1">
              {employees.map((emp) => {
                const empShifts = userShifts.get(emp.user_id) ?? [];
                const isDayOff = empShifts.some((s) => s.is_day_off);
                const name = emp.full_name ?? "—";

                return (
                  <div key={emp.user_id} className="flex items-center group min-h-[36px]">
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

                    <div className="flex-1 relative h-8 bg-secondary/60 rounded-lg overflow-hidden border border-border/40">
                      {hours.map((h, idx) => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-l border-border/20"
                          style={{ left: `${(idx / hours.length) * 100}%` }}
                        />
                      ))}

                      {isDayOff ? (
                        <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-destructive">RIPOSO</span>
                        </div>
                      ) : (
                        empShifts
                          .filter((s) => !s.is_day_off && s.start_time && s.end_time)
                          .map((s) => (
                            <DraggableShiftBar
                              key={s.id}
                              shift={s}
                              openH={openH}
                              totalSpan={totalSpan}
                              canEdit={canEdit && !isArchived}
                              onShiftUpdate={handleDragUpdate}
                              allowedEntries={allowedEntries}
                              allowedExits={allowedExits}
                            />
                          ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {employees.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessun dipendente nel reparto {department}
              </p>
            )}

            {/* Lending section */}
            {lendings.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRightLeft className="h-4 w-4 text-chart-4" />
                  <span className="text-xs font-semibold text-foreground">Prestiti Inter-Store</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-chart-4 border-chart-4/30">
                    {lendings.length}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {lendings.map(l => {
                    const isOutgoing = currentStoreId === l.source_store_id;
                    const otherStore = isOutgoing ? l.target_store_name : l.source_store_name;
                    const statusLabel = l.status === "accepted" ? "Confermato" : "In attesa";
                    const statusColor = l.status === "accepted"
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-warning/15 text-warning border-warning/30";

                    return (
                      <div key={l.id} className="rounded-xl border border-border bg-secondary p-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground">{l.user_name ?? "Dipendente"}</span>
                            <Badge variant="outline" className={cn("text-[9px] h-3.5 px-1", statusColor)}>
                              {statusLabel}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {isOutgoing ? "→ Prestato a" : "← Ricevuto da"}{" "}
                            <span className="font-medium text-foreground">{otherStore}</span>
                            {" · "}
                            {l.suggested_start_time?.slice(0, 5)}–{l.suggested_end_time?.slice(0, 5)}
                          </p>
                          {l.reason && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{l.reason}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {selectedEmployee && (
          <EmployeeWeekDrawer
            open={!!selectedEmployee}
            onOpenChange={(v) => !v && setSelectedEmployee(null)}
            employeeName={selectedEmployee.full_name ?? "—"}
            employeeId={selectedEmployee.user_id}
            referenceDate={date}
            allShifts={shifts}
            weeklyContractHours={selectedEmployee.weekly_contract_hours}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
