import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save } from "lucide-react";
import NumberStepper from "./NumberStepper";
import { DAY_LABELS, generateSlots, type OpeningHour, type CoverageReq } from "@/hooks/useStoreSettings";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hours: OpeningHour[];
  coverage: CoverageReq[];
  onSave: (rows: { day_of_week: number; hour_slot: string; department: "sala" | "cucina"; min_staff_required: number }[]) => void;
  isSaving: boolean;
  readOnly: boolean;
}

type CovMap = Record<string, { sala: number; cucina: number }>;

export default function CoverageModal({ open, onOpenChange, hours, coverage, onSave, isSaving, readOnly }: Props) {
  const [activeDay, setActiveDay] = useState("0");

  const initialMap = useMemo(() => {
    const m: CovMap = {};
    coverage.forEach((c) => {
      const slot = c.hour_slot.slice(0, 5);
      const key = `${c.day_of_week}-${slot}`;
      if (!m[key]) m[key] = { sala: 0, cucina: 0 };
      m[key][c.department as "sala" | "cucina"] = c.min_staff_required;
    });
    return m;
  }, [coverage]);

  const [covMap, setCovMap] = useState<CovMap>(initialMap);
  useEffect(() => setCovMap(initialMap), [initialMap]);

  const update = (day: number, slot: string, dept: "sala" | "cucina", val: number) => {
    const key = `${day}-${slot}`;
    setCovMap((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { sala: 0, cucina: 0 }), [dept]: val },
    }));
  };

  const handleSave = () => {
    const rows: { day_of_week: number; hour_slot: string; department: "sala" | "cucina"; min_staff_required: number }[] = [];
    for (let day = 0; day < 7; day++) {
      const oh = hours.find((h) => h.day_of_week === day);
      if (!oh) continue;
      const slots = generateSlots(oh.opening_time, oh.closing_time);
      for (const slot of slots) {
        const key = `${day}-${slot}`;
        const entry = covMap[key] || { sala: 0, cucina: 0 };
        if (entry.sala > 0) rows.push({ day_of_week: day, hour_slot: slot, department: "sala", min_staff_required: entry.sala });
        if (entry.cucina > 0) rows.push({ day_of_week: day, hour_slot: slot, department: "cucina", min_staff_required: entry.cucina });
      }
    }
    onSave(rows);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/90 border-border/50 shadow-2xl sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">Copertura Minima</DialogTitle>
          <DialogDescription>Imposta il personale minimo per ogni slot orario.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeDay} onValueChange={setActiveDay} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="flex flex-wrap gap-1 shrink-0">
            {DAY_LABELS.map((label, i) => (
              <TabsTrigger key={i} value={String(i)} className="text-xs px-2.5">
                {label.slice(0, 3)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-3 pr-1">
            {DAY_LABELS.map((_, dayIdx) => {
              const oh = hours.find((h) => h.day_of_week === dayIdx);
              const slots = oh ? generateSlots(oh.opening_time, oh.closing_time) : [];

              return (
                <TabsContent key={dayIdx} value={String(dayIdx)} className="mt-0">
                  {slots.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nessun orario configurato
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {slots.map((slot) => {
                        const key = `${dayIdx}-${slot}`;
                        const entry = covMap[key] || { sala: 0, cucina: 0 };
                        const endH = parseInt(slot.split(":")[0]) + 1;
                        const endSlot = `${String(endH).padStart(2, "0")}:${slot.split(":")[1]}`;
                        return (
                          <div key={slot} className="flex items-center gap-4 rounded-lg border border-border/40 bg-accent/20 px-3 py-2">
                            <span className="w-24 text-sm font-medium text-foreground shrink-0">
                              {slot} – {endSlot}
                            </span>
                            <div className="flex items-center gap-6 ml-auto">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-10">Sala</span>
                                <NumberStepper value={entry.sala} onChange={(v) => update(dayIdx, slot, "sala", v)} disabled={readOnly} max={99} />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-12">Cucina</span>
                                <NumberStepper value={entry.cucina} onChange={(v) => update(dayIdx, slot, "cucina", v)} disabled={readOnly} max={99} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </div>
        </Tabs>

        {!readOnly && (
          <DialogFooter className="shrink-0 pt-2">
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <Save className="mr-1.5 h-4 w-4" />
              Salva copertura
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
