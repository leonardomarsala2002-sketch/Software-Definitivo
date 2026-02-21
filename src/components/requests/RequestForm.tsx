import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAllowedTimes } from "@/hooks/useStoreSettings";
import { useOpeningHours } from "@/hooks/useStoreSettings";
import { useCreateRequest } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";

const REQUEST_TYPES = [
  { value: "full_day_off", label: "Giorno libero" },
  { value: "morning_off", label: "Mattina libera (Fino alle…)" },
  { value: "evening_off", label: "Sera libera (Dalle…)" },
  { value: "ferie", label: "Ferie" },
  { value: "permesso", label: "Permesso" },
  { value: "malattia", label: "Malattia" },
];

interface Props {
  department: "sala" | "cucina";
  storeId: string;
  onClose: () => void;
}

export default function RequestForm({ department, storeId, onClose }: Props) {
  const { user } = useAuth();
  const { data: allowedTimes } = useAllowedTimes(storeId);
  const { data: openingHours } = useOpeningHours(storeId);
  const createReq = useCreateRequest();

  const [reqType, setReqType] = useState("full_day_off");
  const [date, setDate] = useState("");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const needsHour = reqType === "morning_off" || reqType === "evening_off";

  // Get allowed hours for the selected type/department
  const kind = reqType === "morning_off" ? "exit" : "entry";
  const filteredHours = (allowedTimes ?? [])
    .filter(
      (t) =>
        t.department === department &&
        t.kind === kind &&
        t.is_active
    )
    .map((t) => t.hour)
    .sort((a, b) => a - b);

  // Filter by opening hours for the selected day
  const dayOfWeek = date ? ((new Date(date).getDay() + 6) % 7) : null;
  const dayHours = dayOfWeek !== null
    ? openingHours?.find((h) => h.day_of_week === dayOfWeek)
    : null;

  const openH = dayHours ? parseInt(dayHours.opening_time.split(":")[0], 10) : 0;
  const closeH = dayHours ? parseInt(dayHours.closing_time.split(":")[0], 10) : 24;

  const availableHours = filteredHours.filter((h) => h >= openH && h <= closeH);

  const noHoursConfigured = needsHour && filteredHours.length === 0;

  const handleSubmit = () => {
    if (!user || !date) {
      toast.error("Seleziona una data");
      return;
    }
    if (needsHour && selectedHour === null) {
      toast.error("Seleziona un orario");
      return;
    }
    if (needsHour && selectedHour !== null && !filteredHours.includes(selectedHour)) {
      toast.error("Orario non consentito");
      return;
    }

    createReq.mutate(
      {
        user_id: user.id,
        store_id: storeId,
        request_type: reqType,
        request_date: date,
        selected_hour: needsHour ? selectedHour : null,
        department,
        notes: notes || null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Tipo richiesta</Label>
        <Select value={reqType} onValueChange={(v) => { setReqType(v); setSelectedHour(null); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {REQUEST_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Data</Label>
        <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelectedHour(null); }} />
      </div>

      {needsHour && (
        <div className="space-y-2">
          <Label className="text-xs">
            {reqType === "morning_off" ? "Fino alle (uscita)" : "Dalle (entrata)"}
          </Label>

          {noHoursConfigured ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">
                Orari consentiti non configurati per {department}. Contatta un admin.
              </p>
            </div>
          ) : !date ? (
            <p className="text-xs text-muted-foreground">Seleziona prima una data</p>
          ) : availableHours.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun orario disponibile per questo giorno</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {availableHours.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setSelectedHour(h)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-mono font-medium border transition-colors",
                    h === selectedHour
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-accent/60"
                  )}
                >
                  {String(h).padStart(2, "0")}:00
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Note (opzionale)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1"
          onClick={handleSubmit}
          disabled={createReq.isPending || (needsHour && (noHoursConfigured || selectedHour === null))}
        >
          Invia richiesta
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
