import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Copy, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { DAY_LABELS, type OpeningHour } from "@/hooks/useStoreSettings";
import HourPicker from "./HourPicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hours: OpeningHour[];
  onSave: (hours: OpeningHour[]) => void;
  isSaving: boolean;
  readOnly: boolean;
}

export default function OpeningHoursModal({ open, onOpenChange, hours, onSave, isSaving, readOnly }: Props) {
  const [step, setStep] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [form, setForm] = useState<OpeningHour[]>(hours);

  useEffect(() => {
    setForm(hours);
    setStep(0);
    setSelectedDays([]);
  }, [hours, open]);

  const toggleDay = (d: number) => {
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  const update = (idx: number, field: "opening_time" | "closing_time", value: string) => {
    setForm((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  };

  const applyToAll = () => {
    if (form.length === 0) return;
    const first = form[0];
    setForm((prev) => prev.map((h) => ({ ...h, opening_time: first.opening_time, closing_time: first.closing_time })));
    toast.info("Orario applicato a tutti i giorni");
  };

  const handleSave = () => {
    for (const h of form) {
      const openH = parseInt(h.opening_time.split(":")[0], 10);
      const closeH = parseInt(h.closing_time.split(":")[0], 10);
      // 24:00 means midnight close — always valid if opening < 24
      if (closeH !== 24 && closeH !== 0 && closeH <= openH) {
        toast.error(`${DAY_LABELS[h.day_of_week]}: chiusura deve essere dopo apertura`);
        return;
      }
    }
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/95 border-border/50 shadow-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Orari di Apertura</DialogTitle>
          <DialogDescription className="text-xs">
            {step === 0 ? "Seleziona i giorni da configurare" : step === 1 ? "Imposta orario apertura / chiusura" : "Riepilogo settimanale"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5 justify-center">
          {[0, 1, 2].map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3 py-1">
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <Badge
                  key={i}
                  variant={selectedDays.includes(i) ? "default" : "outline"}
                  className="cursor-pointer select-none text-xs px-3 py-1.5"
                  onClick={() => !readOnly && toggleDay(i)}
                >
                  {label.slice(0, 3)}
                  {selectedDays.includes(i) && <Check className="ml-1 h-3 w-3" />}
                </Badge>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedDays([0,1,2,3,4,5,6])}>
              Seleziona tutti
            </Button>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setStep(1)} disabled={selectedDays.length === 0}>
                Avanti <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3 py-1">
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {form.filter((h) => selectedDays.includes(h.day_of_week)).map((h) => {
                const idx = form.findIndex((x) => x.id === h.id);
                return (
                  <div key={h.id} className="flex items-center gap-2 rounded-md border border-border/40 bg-accent/20 px-2.5 py-1.5">
                    <span className="w-10 text-xs font-medium shrink-0">{DAY_LABELS[h.day_of_week]?.slice(0, 3)}</span>
                    <HourPicker
                      value={h.opening_time}
                      disabled={readOnly}
                      onChange={(v) => update(idx, "opening_time", v)}
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <HourPicker
                      value={h.closing_time}
                      disabled={readOnly}
                      onChange={(v) => update(idx, "closing_time", v)}
                    />
                  </div>
                );
              })}
            </div>

            {!readOnly && selectedDays.length > 1 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                const first = form.find((h) => h.day_of_week === selectedDays[0]);
                if (first) {
                  setForm((prev) =>
                    prev.map((h) => selectedDays.includes(h.day_of_week) ? { ...h, opening_time: first.opening_time, closing_time: first.closing_time } : h)
                  );
                  toast.info("Orario applicato ai giorni selezionati");
                }
              }}>
                <Copy className="mr-1 h-3 w-3" /> Applica primo a tutti i selezionati
              </Button>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Indietro
              </Button>
              <Button size="sm" onClick={() => setStep(2)}>
                Anteprima <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 py-1">
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {form.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-md border border-border/30 bg-accent/10 px-3 py-1.5">
                  <span className="text-xs font-medium">{DAY_LABELS[h.day_of_week]}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {h.opening_time.slice(0, 5)} – {h.closing_time.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>

            {!readOnly && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={applyToAll}>
                <Copy className="mr-1 h-3 w-3" /> Applica lunedì a tutti
              </Button>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Indietro
              </Button>
              {!readOnly && (
                <Button onClick={handleSave} disabled={isSaving} size="sm">
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Salva
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
