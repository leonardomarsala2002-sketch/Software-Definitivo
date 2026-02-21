import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import NumberStepper from "./NumberStepper";
import type { StoreRules } from "@/hooks/useStoreSettings";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rules: StoreRules;
  onSave: (updates: Partial<StoreRules>) => void;
  isSaving: boolean;
  readOnly: boolean;
}

export default function RulesModal({ open, onOpenChange, rules, onSave, isSaving, readOnly }: Props) {
  const [form, setForm] = useState({
    max_team_hours_sala_per_week: (rules as any).max_team_hours_sala_per_week ?? 240,
    max_team_hours_cucina_per_week: (rules as any).max_team_hours_cucina_per_week ?? 240,
    max_split_shifts_per_employee_per_week: (rules as any).max_split_shifts_per_employee_per_week ?? 3,
    mandatory_days_off_per_week: rules.mandatory_days_off_per_week,
  });

  useEffect(() => {
    setForm({
      max_team_hours_sala_per_week: (rules as any).max_team_hours_sala_per_week ?? 240,
      max_team_hours_cucina_per_week: (rules as any).max_team_hours_cucina_per_week ?? 240,
      max_split_shifts_per_employee_per_week: (rules as any).max_split_shifts_per_employee_per_week ?? 3,
      mandatory_days_off_per_week: rules.mandatory_days_off_per_week,
    });
  }, [rules]);

  const fields: { key: keyof typeof form; label: string; min: number; max: number }[] = [
    { key: "max_team_hours_sala_per_week", label: "Max ore Sala / sett.", min: 1, max: 999 },
    { key: "max_team_hours_cucina_per_week", label: "Max ore Cucina / sett.", min: 1, max: 999 },
    { key: "max_split_shifts_per_employee_per_week", label: "Max spezzati / dip. / sett.", min: 0, max: 14 },
    { key: "mandatory_days_off_per_week", label: "Giorni liberi / sett.", min: 0, max: 7 },
  ];

  const handleSave = () => {
    onSave(form as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/95 border-border/50 shadow-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Regole Team</DialogTitle>
          <DialogDescription className="text-xs">Limiti settimanali del team.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-1">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-foreground">{f.label}</span>
              <NumberStepper
                value={form[f.key]}
                onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                min={f.min}
                max={f.max}
                disabled={readOnly}
              />
            </div>
          ))}
        </div>
        {!readOnly && (
          <DialogFooter>
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Salva
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
