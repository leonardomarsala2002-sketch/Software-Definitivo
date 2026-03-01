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
    // Sala
    max_team_hours_sala_per_week: rules.max_team_hours_sala_per_week ?? 240,
    max_daily_team_hours_sala: rules.max_daily_team_hours_sala ?? 40,
    // Cucina
    max_team_hours_cucina_per_week: rules.max_team_hours_cucina_per_week ?? 240,
    max_daily_team_hours_cucina: rules.max_daily_team_hours_cucina ?? 40,
    // Dipendente
    min_daily_hours_per_employee: (rules as any).min_daily_hours_per_employee ?? 4,
    max_daily_hours_per_employee: rules.max_daily_hours_per_employee ?? 8,
    // Generali
    max_split_shifts_per_employee_per_week: rules.max_split_shifts_per_employee_per_week ?? 3,
    mandatory_days_off_per_week: rules.mandatory_days_off_per_week ?? 1,
  });

  useEffect(() => {
    setGenerationEnabled(rules.generation_enabled ?? false);
    setForm({
      max_team_hours_sala_per_week: rules.max_team_hours_sala_per_week ?? 240,
      max_daily_team_hours_sala: rules.max_daily_team_hours_sala ?? 40,
      max_team_hours_cucina_per_week: rules.max_team_hours_cucina_per_week ?? 240,
      max_daily_team_hours_cucina: rules.max_daily_team_hours_cucina ?? 40,
      min_daily_hours_per_employee: (rules as any).min_daily_hours_per_employee ?? 4,
      max_daily_hours_per_employee: rules.max_daily_hours_per_employee ?? 8,
      max_split_shifts_per_employee_per_week: rules.max_split_shifts_per_employee_per_week ?? 3,
      mandatory_days_off_per_week: rules.mandatory_days_off_per_week ?? 1,
    });
  }, [rules]);

  const handleToggleGeneration = (checked: boolean) => {
    setGenerationEnabled(checked);
    onSave({ generation_enabled: checked } as any);
  };

  const handleSave = () => {
    onSave(form as any);
    onOpenChange(false);
  };

  const set = (key: keyof typeof form) => (v: number) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/95 border-border/50 shadow-2xl sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Regole Team</DialogTitle>
          <DialogDescription className="text-xs">Limiti per reparto, dipendente e generali.</DialogDescription>
        </DialogHeader>

        {/* Generation toggle */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
          <div className="space-y-0.5">
            <Label htmlFor="gen-toggle" className="text-[13px] font-medium cursor-pointer">
              Generazione automatica ogni Giovedì
            </Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Turni della settimana successiva generati automaticamente ogni giovedì notte
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

        {/* ── SALA ── */}
        <SectionHeader emoji="🍽️" label="Sala" />
        <div className="grid grid-cols-1 gap-2.5">
          <RuleRow label="Max ore giorno (team)" value={form.max_daily_team_hours_sala} onChange={set("max_daily_team_hours_sala")} min={1} max={200} disabled={readOnly} />
          <RuleRow label="Max ore settimana (team)" value={form.max_team_hours_sala_per_week} onChange={set("max_team_hours_sala_per_week")} min={1} max={999} disabled={readOnly} />
        </div>

        <Separator />

        {/* ── CUCINA ── */}
        <SectionHeader emoji="👨‍🍳" label="Cucina" />
        <div className="grid grid-cols-1 gap-2.5">
          <RuleRow label="Max ore giorno (team)" value={form.max_daily_team_hours_cucina} onChange={set("max_daily_team_hours_cucina")} min={1} max={200} disabled={readOnly} />
          <RuleRow label="Max ore settimana (team)" value={form.max_team_hours_cucina_per_week} onChange={set("max_team_hours_cucina_per_week")} min={1} max={999} disabled={readOnly} />
        </div>

        <Separator />

        {/* ── DIPENDENTE ── */}
        <SectionHeader emoji="👤" label="Dipendente" />
        <div className="grid grid-cols-1 gap-2.5">
          <RuleRow label="Min ore giorno" value={form.min_daily_hours_per_employee} onChange={set("min_daily_hours_per_employee")} min={1} max={12} disabled={readOnly} />
          <RuleRow label="Max ore giorno" value={form.max_daily_hours_per_employee} onChange={set("max_daily_hours_per_employee")} min={1} max={16} disabled={readOnly} />
        </div>

        <Separator />

        {/* ── GENERALI ── */}
        <SectionHeader emoji="⚙️" label="Generali" />
        <div className="grid grid-cols-1 gap-2.5">
          <RuleRow label="Max spezzati / dip. / sett." value={form.max_split_shifts_per_employee_per_week} onChange={set("max_split_shifts_per_employee_per_week")} min={1} max={3} disabled={readOnly} />
          <RuleRow label="Giorni liberi / sett." value={form.mandatory_days_off_per_week} onChange={set("mandatory_days_off_per_week")} min={1} max={2} disabled={readOnly} />
        </div>

        {!readOnly && (
          <DialogFooter className="pt-2">
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

function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-base">{emoji}</span>
      <h4 className="text-[13px] font-semibold text-foreground tracking-wide uppercase">{label}</h4>
    </div>
  );
}

function RuleRow({ label, value, onChange, min, max, disabled }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-foreground">{label}</span>
      <NumberStepper value={value} onChange={onChange} min={min} max={max} disabled={disabled} />
    </div>
  );
}
