import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import type { StoreRules } from "@/hooks/useStoreSettings";

interface Props {
  rules: StoreRules;
  onSave: (updates: Partial<StoreRules>) => void;
  isSaving: boolean;
  readOnly: boolean;
}

export default function GeneralRulesSection({ rules, onSave, isSaving, readOnly }: Props) {
  const [form, setForm] = useState({
    max_daily_hours_per_employee: rules.max_daily_hours_per_employee,
    max_weekly_hours_per_employee: rules.max_weekly_hours_per_employee,
    max_daily_team_hours: rules.max_daily_team_hours,
    max_split_shifts_per_employee: rules.max_split_shifts_per_employee,
    mandatory_days_off_per_week: rules.mandatory_days_off_per_week,
    generation_enabled: rules.generation_enabled,
  });

  useEffect(() => {
    setForm({
      max_daily_hours_per_employee: rules.max_daily_hours_per_employee,
      max_weekly_hours_per_employee: rules.max_weekly_hours_per_employee,
      max_daily_team_hours: rules.max_daily_team_hours,
      max_split_shifts_per_employee: rules.max_split_shifts_per_employee,
      mandatory_days_off_per_week: rules.mandatory_days_off_per_week,
      generation_enabled: rules.generation_enabled,
    });
  }, [rules]);

  const fields: { key: keyof typeof form; label: string; min: number; max: number }[] = [
    { key: "max_daily_hours_per_employee", label: "Max ore giornaliere / dipendente", min: 1, max: 24 },
    { key: "max_weekly_hours_per_employee", label: "Max ore settimanali / dipendente", min: 1, max: 168 },
    { key: "max_daily_team_hours", label: "Max ore giornaliere team", min: 1, max: 999 },
    { key: "max_split_shifts_per_employee", label: "Max spezzati / dipendente", min: 0, max: 5 },
    { key: "mandatory_days_off_per_week", label: "Giorni liberi obbligatori / settimana", min: 0, max: 7 },
  ];

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Regole Generali</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">{f.label}</Label>
              <Input
                type="number"
                min={f.min}
                max={f.max}
                value={form[f.key] as number}
                disabled={readOnly}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [f.key]: parseInt(e.target.value) || f.min }))
                }
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-accent/40 px-4 py-3">
          <Switch
            checked={form.generation_enabled}
            disabled={readOnly}
            onCheckedChange={(v) => setForm((prev) => ({ ...prev, generation_enabled: v }))}
          />
          <div>
            <p className="text-sm font-medium text-foreground">Generazione automatica turni</p>
            <p className="text-[12px] text-muted-foreground">
              {form.generation_enabled ? "Attiva" : "Disattiva"}
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end pt-2">
            <Button onClick={() => onSave(form)} disabled={isSaving} size="sm">
              <Save className="mr-1.5 h-4 w-4" />
              Salva regole
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
