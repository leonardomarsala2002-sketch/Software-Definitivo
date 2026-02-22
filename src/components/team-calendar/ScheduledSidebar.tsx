import { format } from "date-fns";
import { it } from "date-fns/locale";
import { X, Clock, Coffee, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShiftRow } from "@/hooks/useShifts";

interface Employee {
  user_id: string;
  full_name: string | null;
}

interface ScheduledSidebarProps {
  date: string;
  shifts: ShiftRow[];
  employees: Employee[];
  department: "sala" | "cucina";
  onClose: () => void;
  onOpenDetail: (date: string) => void;
}

export function ScheduledSidebar({
  date,
  shifts,
  employees,
  department,
  onClose,
  onOpenDetail,
}: ScheduledSidebarProps) {
  const dayShifts = shifts.filter(
    (s) => s.date === date && s.department === department
  );

  const dateLabel = format(new Date(date + "T00:00:00"), "EEEE d MMMM", { locale: it });

  return (
    <div className="w-64 shrink-0 rounded-2xl border border-border/60 bg-card shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Scheduled</p>
          <p className="text-sm font-semibold capitalize text-foreground leading-tight">{dateLabel}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Shifts list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {dayShifts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nessun turno programmato
          </p>
        ) : (
          dayShifts.map((s) => {
            const emp = employees.find((e) => e.user_id === s.user_id);
            const name = emp?.full_name ?? "?";
            const timeLabel = s.is_day_off
              ? "Giorno libero"
              : `${s.start_time?.slice(0, 5) ?? ""} – ${s.end_time?.slice(0, 5) ?? ""}`;

            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-xl p-2.5 flex items-start gap-2 border border-l-2",
                  s.is_day_off
                    ? "bg-destructive/5 border-destructive/20 border-l-destructive"
                    : s.status === "draft"
                      ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 border-l-amber-500"
                      : s.status === "archived"
                        ? "bg-muted/50 border-border/40 border-l-muted-foreground/40"
                        : "bg-primary/5 border-primary/20 border-l-primary"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg p-1 shrink-0 mt-0.5",
                    s.is_day_off
                      ? "bg-destructive/10 text-destructive"
                      : s.status === "draft"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-primary/10 text-primary"
                  )}
                >
                  {s.is_day_off ? (
                    <Coffee className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                  <p className="text-[10px] text-muted-foreground">{timeLabel}</p>
                  {s.status === "draft" && (
                    <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">Draft</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer summary */}
      <div className="px-4 py-2 border-t border-border/60 bg-muted/20 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {dayShifts.filter(s => !s.is_day_off).length} turni ·{" "}
          {dayShifts.filter(s => s.is_day_off).length} riposi
        </p>
        <button
          onClick={() => onOpenDetail(date)}
          className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
        >
          {dayShifts.length > 0 ? "Modifica" : "Aggiungi"}
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
