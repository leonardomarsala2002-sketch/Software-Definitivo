import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAllowedTimes } from "@/hooks/useStoreSettings";
import { useOpeningHours } from "@/hooks/useStoreSettings";
import { useCreateRequest } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";
import IllnessCertificateUploadDialog from "./IllnessCertificateUploadDialog";

const REQUEST_TYPES = [
  { value: "giorno_libero", label: "Giorno libero" },
  { value: "mattina_libera", label: "Mattina libera (Fino alle…)" },
  { value: "sera_libera", label: "Sera libera (Dalle…)" },
  { value: "ferie", label: "Ferie" },
  { value: "permesso", label: "Permesso" },
  { value: "permesso_104", label: "Permesso 104" },
  { value: "malattia", label: "Malattia (+ certificato)" },
];

interface Props {
  department: "sala" | "cucina";
  storeId: string;
  onClose: () => void;
  autoApprove?: boolean;
}

export default function RequestForm({ department, storeId, onClose, autoApprove = false }: Props) {
  const { user } = useAuth();
  const { data: allowedTimes } = useAllowedTimes(storeId);
  const { data: openingHours } = useOpeningHours(storeId);
  const createReq = useCreateRequest();

  const [reqType, setReqType] = useState("giorno_libero");
  const [date, setDate] = useState("");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showCertUpload, setShowCertUpload] = useState(false);

  const isDateLocked = useMemo(() => {
    if (!date) return false;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const isThursdayOrLater = dayOfWeek >= 4 || dayOfWeek === 0;
    if (!isThursdayOrLater) return false;
    const daysUntilMon = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMon = new Date(now);
    nextMon.setDate(nextMon.getDate() + daysUntilMon);
    const nextSun = new Date(nextMon);
    nextSun.setDate(nextSun.getDate() + 6);
    const selectedDate = new Date(date + "T00:00:00");
    return selectedDate >= nextMon && selectedDate <= nextSun;
  }, [date]);

  const needsHour = reqType === "mattina_libera" || reqType === "sera_libera";
  const isMalattia = reqType === "malattia";

  const kind = reqType === "mattina_libera" ? "exit" : "entry";
  const filteredHours = (allowedTimes ?? [])
    .filter((t) => t.department === department && t.kind === kind && t.is_active)
    .map((t) => t.hour)
    .sort((a, b) => a - b);

  const dayOfWeek = date ? ((new Date(date).getDay() + 6) % 7) : null;
  const dayHours = dayOfWeek !== null ? openingHours?.find((h) => h.day_of_week === dayOfWeek) : null;
  const openH = dayHours ? parseInt(dayHours.opening_time.split(":")[0], 10) : 0;
  const closeH = dayHours ? parseInt(dayHours.closing_time.split(":")[0], 10) : 24;
  const availableHours = filteredHours.filter((h) => h >= openH && h <= closeH);
  const noHoursConfigured = needsHour && filteredHours.length === 0;

  const handleSubmit = () => {
    if (!user || !date) { toast.error("Seleziona una data"); return; }
    if (isDateLocked) {
      toast.error("La generazione turni per la prossima settimana è già in corso. Le richieste per quella settimana sono bloccate.");
      return;
    }
    if (needsHour && selectedHour === null) { toast.error("Seleziona un orario"); return; }
    if (needsHour && selectedHour !== null && !filteredHours.includes(selectedHour)) {
      toast.error("Orario non consentito"); return;
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
        autoApprove,
      },
      {
        onSuccess: () => {
          if (isMalattia) {
            setShowCertUpload(true);
          } else {
            onClose();
          }
        },
      }
    );
  };

  if (showCertUpload) {
    return (
      <IllnessCertificateUploadDialog
        storeId={storeId}
        date={date}
        onDone={onClose}
      />
    );
  }

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
        {isDateLocked && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 mt-1">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive">
              La generazione turni per la prossima settimana è già in corso. Le richieste per quella settimana sono bloccate.
            </p>
          </div>
        )}
      </div>

      {needsHour && (
        <div className="space-y-2">
          <Label className="text-xs">
            {reqType === "mattina_libera" ? "Fino alle (uscita)" : "Dalle (entrata)"}
          </Label>
          {noHoursConfigured ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">Orari consentiti non configurati per {department}. Contatta un admin.</p>
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

      {isMalattia && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-3">
          <Upload className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Dopo la richiesta potrai caricare il certificato medico.
          </p>
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
          disabled={createReq.isPending || isDateLocked || (needsHour && (noHoursConfigured || selectedHour === null))}
        >
          {autoApprove ? "Crea e approva" : "Invia richiesta"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
