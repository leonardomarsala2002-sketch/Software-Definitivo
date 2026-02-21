import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useEmployeeAvailability,
  useBulkCreateAvailability,
  useDeleteAvailability,
  DAY_LABELS,
  DAY_LABELS_SHORT,
} from "@/hooks/useEmployees";

interface Props {
  userId: string;
  storeId: string | null;
  canEdit: boolean;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0..24

export default function EmployeeAvailabilityTab({ userId, storeId, canEdit }: Props) {
  const { data: availability, isLoading } = useEmployeeAvailability(userId);
  const createBulk = useBulkCreateAvailability();
  const deleteAvail = useDeleteAvailability();

  const [showForm, setShowForm] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
  const [availType, setAvailType] = useState<"available" | "unavailable">("available");

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleApply = () => {
    if (!storeId) {
      toast.error("Nessuno store primario assegnato");
      return;
    }
    if (selectedDays.length === 0) {
      toast.error("Seleziona almeno un giorno");
      return;
    }
    if (startHour === null || endHour === null) {
      toast.error("Seleziona orario di inizio e fine");
      return;
    }
    if (endHour <= startHour) {
      toast.error("L'ora di fine deve essere successiva all'ora di inizio");
      return;
    }

    const startStr = `${String(startHour).padStart(2, "0")}:00`;
    const endStr = endHour === 24 ? "24:00" : `${String(endHour).padStart(2, "0")}:00`;

    const rows = selectedDays.map((day) => ({
      user_id: userId,
      store_id: storeId,
      day_of_week: day,
      start_time: startStr,
      end_time: endStr,
      availability_type: availType,
    }));

    createBulk.mutate(rows, {
      onSuccess: () => {
        setShowForm(false);
        setSelectedDays([]);
        setStartHour(null);
        setEndHour(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  // Group by day for compact weekly preview
  const grouped = new Map<number, typeof availability>();
  availability?.forEach((a) => {
    const list = grouped.get(a.day_of_week) ?? [];
    list.push(a);
    grouped.set(a.day_of_week, list);
  });

  return (
    <div className="space-y-4 py-2">
      {/* Compact weekly preview */}
      {availability && availability.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nessuna disponibilità configurata
        </p>
      )}

      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
        const slots = grouped.get(day);
        if (!slots) return null;
        return (
          <div key={day} className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              {DAY_LABELS[day]}
            </p>
            <div className="space-y-1.5">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </Badge>
                    <Badge
                      variant={slot.availability_type === "available" ? "default" : "destructive"}
                      className="text-[11px]"
                    >
                      {slot.availability_type === "available" ? "Disponibile" : "Non disponibile"}
                    </Badge>
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteAvail.mutate({ id: slot.id, userId })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Add form */}
      {canEdit && !showForm && (
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Aggiungi disponibilità
        </Button>
      )}

      {showForm && (
        <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
          {/* Day multi-select */}
          <div className="space-y-2">
            <Label className="text-xs">Giorni</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS_SHORT.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "h-9 w-11 rounded-md text-xs font-medium border transition-colors",
                    selectedDays.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Hour grid - start */}
          <div className="space-y-2">
            <Label className="text-xs">Inizio</Label>
            <div className="grid grid-cols-6 gap-1">
              {HOURS.filter((h) => h < 24).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setStartHour(h)}
                  className={cn(
                    "h-8 rounded text-xs font-mono border transition-colors",
                    startHour === h
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          {/* Hour grid - end */}
          <div className="space-y-2">
            <Label className="text-xs">Fine</Label>
            <div className="grid grid-cols-6 gap-1">
              {HOURS.filter((h) => h > 0).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setEndHour(h)}
                  className={cn(
                    "h-8 rounded text-xs font-mono border transition-colors",
                    endHour === h
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {h === 24 ? "24" : String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          {/* Availability type toggle */}
          <div className="space-y-2">
            <Label className="text-xs">Tipo</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAvailType("available")}
                className={cn(
                  "flex-1 h-9 rounded-md text-xs font-medium border transition-colors flex items-center justify-center gap-1.5",
                  availType === "available"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent"
                )}
              >
                {availType === "available" && <Check className="h-3 w-3" />}
                Disponibile
              </button>
              <button
                type="button"
                onClick={() => setAvailType("unavailable")}
                className={cn(
                  "flex-1 h-9 rounded-md text-xs font-medium border transition-colors flex items-center justify-center gap-1.5",
                  availType === "unavailable"
                    ? "bg-destructive text-destructive-foreground border-destructive"
                    : "bg-background text-foreground border-border hover:bg-accent"
                )}
              >
                {availType === "unavailable" && <Check className="h-3 w-3" />}
                Non disponibile
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleApply} disabled={createBulk.isPending} className="flex-1">
              Applica ai giorni selezionati
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setSelectedDays([]); setStartHour(null); setEndHour(null); }}>
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
