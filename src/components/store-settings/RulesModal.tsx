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
    max_daily_team_hours_sala: (rules as any).max_daily_team_hours_sala ?? 40,
    max_daily_team_hours_cucina: (rules as any).max_daily_team_hours_cucina ?? 40,
    max_split_shifts_per_employee: rules.max_split_shifts_per_employee,
    mandatory_days_off_per_week: rules.mandatory_days_off_per_week,
  });

  useEffect(() => {
    setForm({
      max_daily_team_hours_sala: (rules as any).max_daily_team_hours_sala ?? 40,
      max_daily_team_hours_cucina: (rules as any).max_daily_team_hours_cucina ?? 40,
      max_split_shifts_per_employee: rules.max_split_shifts_per_employee,
      mandatory_days_off_per_week: rules.mandatory_days_off_per_week,
    });
  }, [rules]);

  const fields: { key: keyof typeof form; label: string; min: number; max: number }[] = [
    { key: "max_daily_team_hours_sala", label: "Max ore giornaliere team Sala", min: 1, max: 999 },
    { key: "max_daily_team_hours_cucina", label: "Max ore giornaliere team Cucina", min: 1, max: 999 },
    { key: "max_split_shifts_per_employee", label: "Max spezzati / dipendente", min: 0, max: 5 },
    { key: "mandatory_days_off_per_week", label: "Giorni liberi obbligatori / settimana", min: 0, max: 7 },
  ];

  const handleSave = () => {
    onSave(form as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/90 border-border/50 shadow-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Regole Team</DialogTitle>
          <DialogDescription>Configura i limiti operativi per il team.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-foreground">{f.label}</span>
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
              <Save className="mr-1.5 h-4 w-4" />
              Salva regole
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
