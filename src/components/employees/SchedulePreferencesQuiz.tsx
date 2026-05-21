import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, Clock, CalendarOff, Repeat, StickyNote } from "lucide-react";

const DAYS = [
  { label: "Lun", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Mer", value: 3 },
  { label: "Gio", value: 4 },
  { label: "Ven", value: 5 },
  { label: "Sab", value: 6 },
  { label: "Dom", value: 0 },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  onSaved?: () => void;
}

interface FormState {
  prefer_morning: boolean;
  prefer_afternoon: boolean;
  prefer_evening: boolean;
  preferred_days_off: number[];
  preferred_weekly_hours: number;
  prefer_split_shifts: boolean;
  max_consecutive_days: number;
  preference_notes: string;
}

export function SchedulePreferencesQuiz({ open, onOpenChange, storeId, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    prefer_morning: false,
    prefer_afternoon: false,
    prefer_evening: false,
    preferred_days_off: [],
    preferred_weekly_hours: 40,
    prefer_split_shifts: false,
    max_consecutive_days: 5,
    preference_notes: "",
  });

  function toggleDayOff(day: number) {
    setForm(f => ({
      ...f,
      preferred_days_off: f.preferred_days_off.includes(day)
        ? f.preferred_days_off.filter(d => d !== day)
        : [...f.preferred_days_off, day],
    }));
  }

  // Derive preferred_shift_type from checkboxes
  function getShiftType(): string {
    const { prefer_morning, prefer_afternoon, prefer_evening } = form;
    if (prefer_morning && !prefer_afternoon && !prefer_evening) return "morning";
    if (!prefer_morning && prefer_afternoon && !prefer_evening) return "afternoon";
    if (!prefer_morning && !prefer_afternoon && prefer_evening) return "evening";
    return "any";
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("employee_preferences").upsert({
        user_id: user.id,
        store_id: storeId,
        preferred_shift_type: getShiftType(),
        preferred_days_off: form.preferred_days_off,
        prefers_opening: form.prefer_morning,
        prefers_closing: form.prefer_evening,
        prefer_split_shifts: form.prefer_split_shifts,
        max_consecutive_days: form.max_consecutive_days,
        preferred_weekly_hours: form.preferred_weekly_hours,
        preference_notes: form.preference_notes || null,
        quiz_completed: true,
        quiz_completed_at: new Date().toISOString(),
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (error) throw error;
      toast.success("Preferenze salvate! Saranno usate nella generazione degli orari.");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error("Errore nel salvataggio. Riprova.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-primary" />
            Preferenze orario
          </DialogTitle>
          <DialogDescription>
            Rispondi alle domande per aiutare il sistema a generare orari su misura per te.
            Le tue preferenze sono indicative — le regole del locale hanno priorità.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* Turni preferiti */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Fascia oraria preferita
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { key: "prefer_morning"   as const, label: "Mattina",    sub: "prima di 14:00" },
                { key: "prefer_afternoon" as const, label: "Pomeriggio", sub: "14:00 – 18:00" },
                { key: "prefer_evening"   as const, label: "Sera",       sub: "dopo le 18:00"  },
              ].map(({ key, label, sub }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                  className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all cursor-pointer min-w-[100px] ${
                    form[key]
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <span className="font-medium text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground">{sub}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Giorni di riposo preferiti */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 font-medium text-sm">
              <CalendarOff className="h-4 w-4 text-muted-foreground" />
              Giorni di riposo preferiti
            </div>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDayOff(value)}
                  className={`h-9 w-10 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                    form.preferred_days_off.includes(value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.preferred_days_off.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {form.preferred_days_off.length} giorn{form.preferred_days_off.length === 1 ? "o" : "i"} selezionat{form.preferred_days_off.length === 1 ? "o" : "i"}
              </p>
            )}
          </section>

          {/* Ore settimanali preferite */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Ore settimanali preferite
              </div>
              <Badge variant="secondary">{form.preferred_weekly_hours}h/sett</Badge>
            </div>
            <Slider
              min={8}
              max={48}
              step={2}
              value={[form.preferred_weekly_hours]}
              onValueChange={([v]) => setForm(f => ({ ...f, preferred_weekly_hours: v }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>8h (part-time)</span>
              <span>24h</span>
              <span>40h (full-time)</span>
              <span>48h</span>
            </div>
          </section>

          {/* Turni spezzati */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              Turni spezzati (pranzo + cena)
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <Switch
                id="split"
                checked={form.prefer_split_shifts}
                onCheckedChange={v => setForm(f => ({ ...f, prefer_split_shifts: v }))}
              />
              <Label htmlFor="split" className="cursor-pointer text-sm">
                {form.prefer_split_shifts
                  ? "Preferisco i turni spezzati"
                  : "Preferisco turni continuativi"}
              </Label>
            </div>
          </section>

          {/* Giorni consecutivi */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Max giorni consecutivi</span>
              <Badge variant="secondary">{form.max_consecutive_days} giorni</Badge>
            </div>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, max_consecutive_days: n }))}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all cursor-pointer ${
                    form.max_consecutive_days === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>

          {/* Note */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 font-medium text-sm">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              Note aggiuntive (opzionale)
            </div>
            <Textarea
              placeholder="Es: non disponibile il mercoledì mattina, preferisco non lavorare la domenica sera..."
              value={form.preference_notes}
              onChange={e => setForm(f => ({ ...f, preference_notes: e.target.value }))}
              className="resize-none text-sm"
              rows={3}
            />
          </section>

        </div>

        <div className="flex gap-3 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Salvataggio…" : "Salva preferenze"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
