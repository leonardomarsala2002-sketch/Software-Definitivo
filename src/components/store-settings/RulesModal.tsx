import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  const [generationEnabled, setGenerationEnabled] = useState(rules.generation_enabled ?? false);
  const [form, setForm] = useState({
    max_team_hours_sala_per_week: (rules as any).max_team_hours_sala_per_week ?? 240,
    max_team_hours_cucina_per_week: (rules as any).max_team_hours_cucina_per_week ?? 240,
    max_split_shifts_per_employee_per_week: (rules as any).max_split_shifts_per_employee_per_week ?? 3,
    mandatory_days_off_per_week: rules.mandatory_days_off_per_week,
  });

  useEffect(() => {
    setGenerationEnabled(rules.generation_enabled ?? false);
    setForm({
      max_team_hours_sala_per_week: (rules as any).max_team_hours_sala_per_week ?? 240,
      max_team_hours_cucina_per_week: (rules as any).max_team_hours_cucina_per_week ?? 240,
      max_split_shifts_per_employee_per_week: (rules as any).max_split_shifts_per_employee_per_week ?? 3,
      mandatory_days_off_per_week: rules.mandatory_days_off_per_week,
    });
  }, [rules]);

  const handleToggleGeneration = (checked: boolean) => {
    setGenerationEnabled(checked);
    onSave({ generation_enabled: checked } as any);
  };

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

        {/* Generation toggle */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
          <div className="space-y-0.5">
            <Label htmlFor="gen-toggle" className="text-[13px] font-medium cursor-pointer">
              Generazione automatica ogni Giovedì
            </Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Quando attivo, i turni della settimana successiva vengono generati automaticamente ogni giovedì notte
            </p>
          </div>
          <Switch
            id="gen-toggle"
            checked={generationEnabled}
            onCheckedChange={handleToggleGeneration}
            disabled={readOnly || isSaving}
          />
        </div>

        <Separator />

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
