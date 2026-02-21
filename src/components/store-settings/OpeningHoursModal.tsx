import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Copy } from "lucide-react";
import { toast } from "sonner";
import { DAY_LABELS, type OpeningHour } from "@/hooks/useStoreSettings";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hours: OpeningHour[];
  onSave: (hours: OpeningHour[]) => void;
  isSaving: boolean;
  readOnly: boolean;
}

export default function OpeningHoursModal({ open, onOpenChange, hours, onSave, isSaving, readOnly }: Props) {
  const [form, setForm] = useState<OpeningHour[]>(hours);

  useEffect(() => {
    setForm(hours);
  }, [hours]);

  const update = (idx: number, field: "opening_time" | "closing_time", value: string) => {
    setForm((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  };

  const applyToAll = () => {
    if (form.length === 0) return;
    const first = form[0];
    setForm((prev) =>
      prev.map((h) => ({ ...h, opening_time: first.opening_time, closing_time: first.closing_time }))
    );
    toast.info("Orario del lunedì applicato a tutti i giorni");
  };

  const handleSave = () => {
    for (const h of form) {
      if (h.closing_time <= h.opening_time) {
        toast.error(`${DAY_LABELS[h.day_of_week]}: chiusura deve essere dopo apertura`);
        return;
      }
    }
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/90 border-border/50 shadow-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Orari di Apertura</DialogTitle>
          <DialogDescription>Configura gli orari di apertura per ogni giorno.</DialogDescription>
        </DialogHeader>

        {!readOnly && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={applyToAll} className="text-xs">
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Applica lunedì a tutti
            </Button>
          </div>
        )}

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {form.map((h, idx) => (
            <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-accent/30 px-3 py-2.5">
              <span className="w-16 text-sm font-medium text-foreground shrink-0">
                {DAY_LABELS[h.day_of_week]?.slice(0, 3)}
              </span>
              <Input
                type="time"
                value={h.opening_time}
                disabled={readOnly}
                className="h-9 max-w-[110px] text-sm"
                onChange={(e) => update(idx, "opening_time", e.target.value)}
              />
              <span className="text-muted-foreground text-xs">–</span>
              <Input
                type="time"
                value={h.closing_time}
                disabled={readOnly}
                className="h-9 max-w-[110px] text-sm"
                onChange={(e) => update(idx, "closing_time", e.target.value)}
              />
            </div>
          ))}
        </div>

        {!readOnly && (
          <DialogFooter>
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <Save className="mr-1.5 h-4 w-4" />
              Salva orari
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
