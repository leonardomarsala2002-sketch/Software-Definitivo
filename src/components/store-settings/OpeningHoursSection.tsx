import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { DAY_LABELS, type OpeningHour } from "@/hooks/useStoreSettings";

interface Props {
  hours: OpeningHour[];
  onSave: (hours: OpeningHour[]) => void;
  isSaving: boolean;
  readOnly: boolean;
}

export default function OpeningHoursSection({ hours, onSave, isSaving, readOnly }: Props) {
  const [form, setForm] = useState<OpeningHour[]>(hours);

  useEffect(() => {
    setForm(hours);
  }, [hours]);

  const update = (idx: number, field: "opening_time" | "closing_time", value: string) => {
    setForm((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  };

  const handleSave = () => {
    // Validate closing > opening
    for (const h of form) {
      if (h.closing_time <= h.opening_time) {
        toast.error(`${DAY_LABELS[h.day_of_week]}: l'orario di chiusura deve essere dopo l'apertura`);
        return;
      }
    }
    onSave(form);
  };

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Orari di Apertura</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="pb-2 text-left text-[13px] font-medium text-muted-foreground">Giorno</th>
                <th className="pb-2 text-left text-[13px] font-medium text-muted-foreground">Apertura</th>
                <th className="pb-2 text-left text-[13px] font-medium text-muted-foreground">Chiusura</th>
              </tr>
            </thead>
            <tbody>
              {form.map((h, idx) => (
                <tr key={h.id} className="border-b border-border/30 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-foreground">{DAY_LABELS[h.day_of_week]}</td>
                  <td className="py-2.5 pr-4">
                    <Input
                      type="time"
                      value={h.opening_time}
                      disabled={readOnly}
                      className="max-w-[140px]"
                      onChange={(e) => update(idx, "opening_time", e.target.value)}
                    />
                  </td>
                  <td className="py-2.5">
                    <Input
                      type="time"
                      value={h.closing_time}
                      disabled={readOnly}
                      className="max-w-[140px]"
                      onChange={(e) => update(idx, "closing_time", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <Save className="mr-1.5 h-4 w-4" />
              Salva orari
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
