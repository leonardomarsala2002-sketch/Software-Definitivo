import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

  useEffect(() => {
    setGenerationEnabled(rules.generation_enabled ?? false);
  }, [rules]);

  const handleToggleGeneration = (checked: boolean) => {
    setGenerationEnabled(checked);
    onSave({ generation_enabled: checked } as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/95 border-border/50 shadow-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Regole Team</DialogTitle>
          <DialogDescription className="text-xs">
            Gestione automatica dei turni. Spezzati, giorni liberi e limiti orari vengono ottimizzati dall'algoritmo.
          </DialogDescription>
        </DialogHeader>

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

        <p className="text-[11px] text-muted-foreground leading-snug px-1">
          L'algoritmo gestisce automaticamente turni spezzati, giorni liberi, limiti orari sala/cucina e orari di entrata/uscita per garantire la copertura ottimale.
        </p>
      </DialogContent>
    </Dialog>
  );
}
