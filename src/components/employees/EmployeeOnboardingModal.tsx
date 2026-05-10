import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const DAYS_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const DAY_VALUES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
}

export function EmployeeOnboardingModal({ open, onOpenChange, storeId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["employee-preferences", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && open,
  });

  const [shiftType, setShiftType] = useState<string>("any");
  const [weekendAvail, setWeekendAvail] = useState<string>("available");
  const [prefDaysOff, setPrefDaysOff] = useState<string[]>([]);
  const [prefersOpening, setPrefersOpening] = useState(false);
  const [prefersClosing, setPrefersClosing] = useState(false);
  const [hourDist, setHourDist] = useState<string>("even");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Pre-fill from existing data
  if (existing && !initialized) {
    setShiftType(existing.preferred_shift_type ?? "any");
    setWeekendAvail(existing.weekend_availability ?? "available");
    setPrefDaysOff(existing.preferred_days_off ?? []);
    setPrefersOpening(existing.prefers_opening ?? false);
    setPrefersClosing(existing.prefers_closing ?? false);
    setHourDist(existing.hour_distribution ?? "even");
    setInitialized(true);
  }

  const toggleDay = (day: string) => {
    setPrefDaysOff((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("employee-onboarding", {
        body: {
          store_id: storeId,
          preferred_shift_type: shiftType === "any" ? null : shiftType,
          preferred_days_off: prefDaysOff,
          weekend_availability: weekendAvail,
          prefers_opening: prefersOpening,
          prefers_closing: prefersClosing,
          hour_distribution: hourDist === "even" ? null : hourDist,
        },
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["employee-preferences", user.id] });
      toast.success("Preferenze salvate. Saranno considerate nella generazione turni.");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Errore: ${err.message ?? "Riprova"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Le mie preferenze turni
          </DialogTitle>
          <DialogDescription>
            Indica le tue preferenze. Il sistema le terrà in considerazione (come regola soft) durante la generazione automatica dei turni.
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Tipo turno preferito */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo turno preferito</Label>
              <Select value={shiftType} onValueChange={setShiftType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Nessuna preferenza</SelectItem>
                  <SelectItem value="morning">Mattina (apertura)</SelectItem>
                  <SelectItem value="afternoon">Pomeriggio</SelectItem>
                  <SelectItem value="evening">Sera (chiusura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Giorni liberi preferiti */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Giorni liberi preferiti</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_IT.map((day, i) => {
                  const val = DAY_VALUES[i];
                  const active = prefDaysOff.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => toggleDay(val)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-accent/60"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Disponibilità weekend */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Disponibilità weekend</Label>
              <Select value={weekendAvail} onValueChange={setWeekendAvail}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponibile</SelectItem>
                  <SelectItem value="limited">Limitata (un weekend sì, uno no)</SelectItem>
                  <SelectItem value="unavailable">Non disponibile</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Apertura / Chiusura */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="prefers-opening" className="text-xs cursor-pointer">
                  Preferisco apertura
                  <p className="font-normal text-muted-foreground mt-0.5">Primo turno del giorno</p>
                </Label>
                <Switch id="prefers-opening" checked={prefersOpening} onCheckedChange={setPrefersOpening} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="prefers-closing" className="text-xs cursor-pointer">
                  Preferisco chiusura
                  <p className="font-normal text-muted-foreground mt-0.5">Ultimo turno del giorno</p>
                </Label>
                <Switch id="prefers-closing" checked={prefersClosing} onCheckedChange={setPrefersClosing} />
              </div>
            </div>

            {/* Distribuzione ore */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Distribuzione ore settimanali</Label>
              <Select value={hourDist} onValueChange={setHourDist}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="even">Distribuita uniformemente</SelectItem>
                  <SelectItem value="front_loaded">Più ore a inizio settimana</SelectItem>
                  <SelectItem value="back_loaded">Più ore a fine settimana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Salvataggio…</> : "Salva preferenze"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Annulla
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
