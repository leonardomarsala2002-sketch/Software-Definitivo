import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save } from "lucide-react";
import { DAY_LABELS, type OpeningHour, type CoverageReq } from "@/hooks/useStoreSettings";

interface Props {
  hours: OpeningHour[];
  coverage: CoverageReq[];
  onSave: (rows: { day_of_week: number; hour_slot: string; department: "sala" | "cucina"; min_staff_required: number }[]) => void;
  isSaving: boolean;
  readOnly: boolean;
}

function generateSlots(opening: string, closing: string): string[] {
  const slots: string[] = [];
  const [oh, om] = opening.split(":").map(Number);
  const [ch, cm] = closing.split(":").map(Number);
  const startMin = oh * 60 + (om || 0);
  const endMin = ch * 60 + (cm || 0);
  for (let m = startMin; m < endMin; m += 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

type CovMap = Record<string, { sala: number; cucina: number }>;

export default function CoverageSection({ hours, coverage, onSave, isSaving, readOnly }: Props) {
  const [activeDay, setActiveDay] = useState("0");

  // Build map: key = `${day}-${slot}` → { sala, cucina }
  const initialMap = useMemo(() => {
    const m: CovMap = {};
    coverage.forEach((c) => {
      const slot = c.hour_slot.slice(0, 5); // "HH:MM"
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
  };

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Copertura Minima</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeDay} onValueChange={setActiveDay}>
          <TabsList className="mb-4 flex flex-wrap gap-1">
            {DAY_LABELS.map((label, i) => (
              <TabsTrigger key={i} value={String(i)} className="text-xs">
                {label.slice(0, 3)}
              </TabsTrigger>
            ))}
          </TabsList>

          {DAY_LABELS.map((_, dayIdx) => {
            const oh = hours.find((h) => h.day_of_week === dayIdx);
            const slots = oh ? generateSlots(oh.opening_time, oh.closing_time) : [];

            return (
              <TabsContent key={dayIdx} value={String(dayIdx)}>
                {slots.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nessun orario di apertura configurato per questo giorno
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60">
                          <th className="pb-2 text-left text-[13px] font-medium text-muted-foreground">Slot</th>
                          <th className="pb-2 text-center text-[13px] font-medium text-muted-foreground">Sala</th>
                          <th className="pb-2 text-center text-[13px] font-medium text-muted-foreground">Cucina</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((slot) => {
                          const key = `${dayIdx}-${slot}`;
                          const entry = covMap[key] || { sala: 0, cucina: 0 };
                          const endH = parseInt(slot.split(":")[0]) + 1;
                          const endSlot = `${String(endH).padStart(2, "0")}:${slot.split(":")[1]}`;
                          return (
                            <tr key={slot} className="border-b border-border/30 last:border-0">
                              <td className="py-2 pr-4 font-medium text-foreground">
                                {slot} – {endSlot}
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={99}
                                  value={entry.sala}
                                  disabled={readOnly}
                                  className="mx-auto max-w-[72px] text-center"
                                  onChange={(e) => update(dayIdx, slot, "sala", parseInt(e.target.value) || 0)}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={99}
                                  value={entry.cucina}
                                  disabled={readOnly}
                                  className="mx-auto max-w-[72px] text-center"
                                  onChange={(e) => update(dayIdx, slot, "cucina", parseInt(e.target.value) || 0)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        {!readOnly && (
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <Save className="mr-1.5 h-4 w-4" />
              Salva copertura
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
