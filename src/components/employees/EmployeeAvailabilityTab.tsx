import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useEmployeeAvailability,
  useCreateAvailability,
  useDeleteAvailability,
  DAY_LABELS,
} from "@/hooks/useEmployees";

interface Props {
  userId: string;
  storeId: string | null;
  canEdit: boolean;
}

export default function EmployeeAvailabilityTab({ userId, storeId, canEdit }: Props) {
  const { data: availability, isLoading } = useEmployeeAvailability(userId);
  const createAvail = useCreateAvailability();
  const deleteAvail = useDeleteAvailability();

  const [showForm, setShowForm] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const handleAdd = () => {
    if (!storeId) {
      toast.error("Nessuno store primario assegnato");
      return;
    }
    if (endTime <= startTime) {
      toast.error("L'ora di fine deve essere successiva all'ora di inizio");
      return;
    }
    createAvail.mutate(
      {
        user_id: userId,
        store_id: storeId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        availability_type: "available",
      },
      { onSuccess: () => setShowForm(false) }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  // Group by day
  const grouped = new Map<number, typeof availability>();
  availability?.forEach((a) => {
    const list = grouped.get(a.day_of_week) ?? [];
    list.push(a);
    grouped.set(a.day_of_week, list);
  });

  return (
    <div className="space-y-4 py-2">
      {availability && availability.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-6">Nessuna disponibilità configurata</p>
      )}

      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
        const slots = grouped.get(day);
        if (!slots) return null;
        return (
          <div key={day} className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{DAY_LABELS[day]}</p>
            <div className="space-y-1.5">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </Badge>
                    <Badge variant={slot.availability_type === "available" ? "default" : "destructive"} className="text-[11px]">
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

      {canEdit && !showForm && (
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Aggiungi fascia oraria
        </Button>
      )}

      {showForm && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
          <div className="space-y-1.5">
            <Label className="text-xs">Giorno</Label>
            <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_LABELS.map((label, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Dalle</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Alle</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={createAvail.isPending} className="flex-1">
              Salva
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
