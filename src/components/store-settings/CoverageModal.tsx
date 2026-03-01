import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, Copy, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import NumberStepper from "./NumberStepper";
import { DAY_LABELS, generateSlots, type OpeningHour, type CoverageReq } from "@/hooks/useStoreSettings";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hours: OpeningHour[];
  coverage: CoverageReq[];
  onSave: (rows: { day_of_week: number; hour_slot: string; department: "sala" | "cucina"; min_staff_required: number; max_staff_required: number | null }[]) => void;
  isSaving: boolean;
  readOnly: boolean;
}

type CovEntry = { sala: number; cucina: number; salaMax: number | null; cucinaMax: number | null };
type CovMap = Record<string, CovEntry>;

export default function CoverageModal({ open, onOpenChange, hours, coverage, onSave, isSaving, readOnly }: Props) {
  const [step, setStep] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([0]);
  const [activeDept, setActiveDept] = useState<"sala" | "cucina">("sala");
  const [rangeEnabled, setRangeEnabled] = useState(false);

  const initialMap = useMemo(() => {
    const m: CovMap = {};
    let hasMax = false;
    coverage.forEach((c) => {
      const slot = c.hour_slot.slice(0, 5);
      const key = `${c.day_of_week}-${slot}`;
      if (!m[key]) m[key] = { sala: 0, cucina: 0, salaMax: null, cucinaMax: null };
      const dept = c.department as "sala" | "cucina";
      m[key][dept] = c.min_staff_required;
      m[key][dept === "sala" ? "salaMax" : "cucinaMax"] = c.max_staff_required ?? null;
      if (c.max_staff_required != null) hasMax = true;
    });
    return { map: m, hasMax };
  }, [coverage]);

  const [covMap, setCovMap] = useState<CovMap>(initialMap.map);
  useEffect(() => {
    setCovMap(initialMap.map);
    setRangeEnabled(initialMap.hasMax);
    setStep(0);
    setSelectedDays([0]);
  }, [initialMap, open]);

  const activeDay = selectedDays[0] ?? 0;
  const oh = hours.find((h) => h.day_of_week === activeDay);
  const slots = oh ? generateSlots(oh.opening_time, oh.closing_time) : [];

  const update = (day: number, slot: string, dept: "sala" | "cucina", val: number, isMax = false) => {
    const key = `${day}-${slot}`;
    setCovMap((prev) => {
      const entry = prev[key] || { sala: 0, cucina: 0, salaMax: null, cucinaMax: null };
      const next = { ...entry };
      if (isMax) {
        next[dept === "sala" ? "salaMax" : "cucinaMax"] = val;
        // Ensure max >= min
        if (val < next[dept]) next[dept] = val;
      } else {
        next[dept] = val;
        // Ensure min <= max when range active
        const maxKey = dept === "sala" ? "salaMax" : "cucinaMax";
        if (rangeEnabled && next[maxKey] !== null && val > next[maxKey]!) {
          next[maxKey] = val;
        }
      }
      return { ...prev, [key]: next };
    });
  };

  const copyToSelectedDays = () => {
    if (selectedDays.length < 2) return;
    const sourceDay = selectedDays[0];
    const sourceOh = hours.find((h) => h.day_of_week === sourceDay);
    if (!sourceOh) return;
    const sourceSlots = generateSlots(sourceOh.opening_time, sourceOh.closing_time);

    setCovMap((prev) => {
      const next = { ...prev };
      for (const targetDay of selectedDays.slice(1)) {
        for (const slot of sourceSlots) {
          const srcKey = `${sourceDay}-${slot}`;
          const tgtKey = `${targetDay}-${slot}`;
          next[tgtKey] = { ...(next[srcKey] || { sala: 0, cucina: 0, salaMax: null, cucinaMax: null }) };
        }
      }
      return next;
    });
    toast.info("Copertura copiata sui giorni selezionati");
  };

  const copyToAll = () => {
    const sourceDay = selectedDays[0] ?? 0;
    const sourceOh = hours.find((h) => h.day_of_week === sourceDay);
    if (!sourceOh) return;
    const sourceSlots = generateSlots(sourceOh.opening_time, sourceOh.closing_time);

    setCovMap((prev) => {
      const next = { ...prev };
      for (let d = 0; d < 7; d++) {
        if (d === sourceDay) continue;
        for (const slot of sourceSlots) {
          const srcKey = `${sourceDay}-${slot}`;
          const tgtKey = `${d}-${slot}`;
          next[tgtKey] = { ...(next[srcKey] || { sala: 0, cucina: 0, salaMax: null, cucinaMax: null }) };
        }
      }
      return next;
    });
    toast.info("Copertura copiata su tutta la settimana");
  };

  const handleSave = () => {
    const rows: { day_of_week: number; hour_slot: string; department: "sala" | "cucina"; min_staff_required: number; max_staff_required: number | null }[] = [];
    for (let day = 0; day < 7; day++) {
      const dayOh = hours.find((h) => h.day_of_week === day);
      if (!dayOh) continue;
      const daySlots = generateSlots(dayOh.opening_time, dayOh.closing_time);
      for (const slot of daySlots) {
        const key = `${day}-${slot}`;
        const entry = covMap[key] || { sala: 0, cucina: 0, salaMax: null, cucinaMax: null };
        if (entry.sala > 0) {
          rows.push({
            day_of_week: day, hour_slot: slot, department: "sala",
            min_staff_required: entry.sala,
            max_staff_required: rangeEnabled ? (entry.salaMax ?? entry.sala) : null,
          });
        }
        if (entry.cucina > 0) {
          rows.push({
            day_of_week: day, hour_slot: slot, department: "cucina",
            min_staff_required: entry.cucina,
            max_staff_required: rangeEnabled ? (entry.cucinaMax ?? entry.cucina) : null,
          });
        }
      }
    }
    onSave(rows);
    onOpenChange(false);
  };

  const toggleDay = (d: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(d)) return prev.length > 1 ? prev.filter((x) => x !== d) : prev;
      return [...prev, d];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/95 border-border/50 shadow-2xl sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">Copertura Richiesta</DialogTitle>
          <DialogDescription className="text-xs">
            {step === 0
              ? "Seleziona giorni e configura slot"
              : rangeEnabled
                ? "Imposta Min e Max personale per slot (il motore ottimizza nel range)"
                : "Imposta il numero esatto di personale per slot"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5 justify-center shrink-0">
          {[0, 1].map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground">Giorni da configurare</p>
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

            {/* Range toggle */}
            {!readOnly && (
              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-accent/10 px-3 py-2">
                <Label htmlFor="range-switch" className="text-xs font-medium cursor-pointer">
                  Abilita range (Min–Max)
                </Label>
                <Switch
                  id="range-switch"
                  checked={rangeEnabled}
                  onCheckedChange={setRangeEnabled}
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={() => setStep(1)}>
                Configura slot <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex-1 overflow-hidden flex flex-col gap-2">
            {/* Day tabs */}
            <div className="flex flex-wrap gap-1 shrink-0">
              {selectedDays.map((d) => (
                <Badge
                  key={d}
                  variant={d === activeDay ? "default" : "outline"}
                  className="cursor-pointer text-[11px] px-2 py-0.5"
                  onClick={() => setSelectedDays((prev) => [d, ...prev.filter((x) => x !== d)])}
                >
                  {DAY_LABELS[d]?.slice(0, 3)}
                </Badge>
              ))}
            </div>

            {/* Department toggle */}
            <div className="flex gap-1 shrink-0">
              {(["sala", "cucina"] as const).map((dept) => (
                <Button
                  key={dept}
                  variant={activeDept === dept ? "default" : "outline"}
                  size="sm"
                  className="text-xs flex-1 h-7"
                  onClick={() => setActiveDept(dept)}
                >
                  {dept === "sala" ? "Sala" : "Cucina"}
                </Button>
              ))}
            </div>

            {/* Slots */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {slots.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Nessun orario configurato per questo giorno</p>
              ) : (
                slots.map((slot) => {
                  const key = `${activeDay}-${slot}`;
                  const entry = covMap[key] || { sala: 0, cucina: 0, salaMax: null, cucinaMax: null };
                  const endH = parseInt(slot.split(":")[0]) + 1;
                  const endSlot = `${String(endH).padStart(2, "0")}:${slot.split(":")[1]}`;
                  const minVal = entry[activeDept];
                  const maxVal = activeDept === "sala" ? entry.salaMax : entry.cucinaMax;

                  return (
                    <div key={slot} className="flex items-center justify-between rounded-md border border-border/30 bg-accent/10 px-2.5 py-1">
                      <span className="text-xs font-medium text-foreground">{slot}–{endSlot}</span>
                      {rangeEnabled ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground font-medium">Min</span>
                            <NumberStepper
                              value={minVal}
                              onChange={(v) => update(activeDay, slot, activeDept, v, false)}
                              disabled={readOnly}
                              max={99}
                              compact
                            />
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground font-medium">Max</span>
                            <NumberStepper
                              value={maxVal ?? minVal}
                              onChange={(v) => update(activeDay, slot, activeDept, v, true)}
                              disabled={readOnly}
                              min={minVal}
                              max={99}
                              compact
                            />
                          </div>
                        </div>
                      ) : (
                        <NumberStepper
                          value={minVal}
                          onChange={(v) => update(activeDay, slot, activeDept, v)}
                          disabled={readOnly}
                          max={99}
                          compact
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Copy actions */}
            {!readOnly && (
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {selectedDays.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={copyToSelectedDays}>
                    <Copy className="mr-1 h-3 w-3" /> Copia su selezionati
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={copyToAll}>
                  <Copy className="mr-1 h-3 w-3" /> Copia su tutta la settimana
                </Button>
              </div>
            )}

            <div className="flex justify-between shrink-0 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Giorni
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
