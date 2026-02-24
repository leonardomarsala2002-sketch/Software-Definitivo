import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, KeyRound, Eye, EyeOff, Plus, Trash2, Check, Clock } from "lucide-react";
import type { EmployeeRow } from "@/hooks/useEmployees";
import { isEmployeeReady, useEmployeeAvailability, useBulkCreateAvailability, useDeleteAvailability, DAY_LABELS, DAY_LABELS_SHORT } from "@/hooks/useEmployees";
import { useUpdateEmployeeDetails } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  employee: EmployeeRow;
  canEdit: boolean;
}

export default function EmployeeInfoTab({ employee, canEdit }: Props) {
  const [department, setDepartment] = useState(employee.department);
  const [hours, setHours] = useState(employee.weekly_contract_hours);
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [isActive, setIsActive] = useState(employee.is_active);

  const update = useUpdateEmployeeDetails();

  const dirty =
    department !== employee.department ||
    hours !== employee.weekly_contract_hours ||
    phone !== (employee.phone ?? "") ||
    isActive !== employee.is_active;

  const ready = isEmployeeReady(employee);

  const handleSave = () => {
    if (hours < 0 || hours > 80) return;
    update.mutate({
      userId: employee.user_id,
      updates: {
        department,
        weekly_contract_hours: hours,
        phone: phone || null,
        is_active: isActive,
      },
    });
  };

  return (
    <div className="space-y-6 py-2">
      {/* Readiness + contract badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-xs font-mono">
          Contratto: {employee.weekly_contract_hours}h/settimana
        </Badge>
        {ready ? (
          <Badge variant="default" className="text-[11px]">Pronto</Badge>
        ) : (
          <Badge variant="destructive" className="text-[11px] gap-1">
            <AlertTriangle className="h-3 w-3" />
            Incompleto
          </Badge>
        )}
      </div>

      {!ready && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Dati insufficienti per la generazione turni. Verifica: reparto e ore contratto (&gt;0).
        </div>
      )}

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Nome</Label>
          <p className="text-sm font-medium text-foreground">{employee.full_name ?? "—"}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Email</Label>
          <p className="text-sm text-foreground">{employee.email ?? "—"}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Store primario</Label>
          <p className="text-sm text-foreground">{employee.primary_store_name ?? "—"}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dept" className="text-muted-foreground text-xs uppercase tracking-wider">Reparto</Label>
          <Select value={department} onValueChange={(v) => setDepartment(v as "sala" | "cucina")} disabled={!canEdit}>
            <SelectTrigger id="dept">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sala">Sala</SelectItem>
              <SelectItem value="cucina">Cucina</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && department !== employee.department && (
            <p className="text-[11px] text-amber-600">Cambiando reparto, le disponibilità esistenti resteranno ma la generazione userà il nuovo reparto.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="hours" className="text-muted-foreground text-xs uppercase tracking-wider">
            Ore contratto settimanali <span className="text-destructive">*</span>
          </Label>
          <Input
            id="hours"
            type="number"
            min={0}
            max={80}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            disabled={!canEdit}
          />
          {hours <= 0 && (
            <p className="text-[11px] text-destructive">Le ore contratto devono essere maggiori di 0.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-muted-foreground text-xs uppercase tracking-wider">Telefono</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="es. +39 333 1234567"
            disabled={!canEdit}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Stato attivo</p>
            <p className="text-xs text-muted-foreground">Il dipendente può ricevere turni</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!canEdit} />
        </div>
      </div>

      {canEdit && (
        <Button onClick={handleSave} disabled={!dirty || update.isPending || hours < 0 || hours > 80} className="w-full gap-2">
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salva modifiche
        </Button>
      )}

      {/* Custom schedule section */}
      <CustomScheduleSection userId={employee.user_id} storeId={employee.primary_store_id} canEdit={canEdit} />

      {canEdit && <AdminResetPasswordButton targetUserId={employee.user_id} />}
    </div>
  );
}

/* ─── Custom Schedule Section ─── */
const HOURS_GRID = Array.from({ length: 25 }, (_, i) => i);

function CustomScheduleSection({ userId, storeId, canEdit }: { userId: string; storeId: string | null; canEdit: boolean }) {
  const { data: availability, isLoading } = useEmployeeAvailability(userId);
  const createBulk = useBulkCreateAvailability();
  const deleteAvail = useDeleteAvailability();

  const [showForm, setShowForm] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);

  const hasCustomSchedule = (availability?.length ?? 0) > 0;

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleApply = () => {
    if (!storeId) { toast.error("Nessuno store primario assegnato"); return; }
    if (selectedDays.length === 0) { toast.error("Seleziona almeno un giorno"); return; }
    if (startHour === null || endHour === null) { toast.error("Seleziona orario di inizio e fine"); return; }
    if (endHour <= startHour) { toast.error("L'ora di fine deve essere successiva all'ora di inizio"); return; }

    const startStr = `${String(startHour).padStart(2, "0")}:00`;
    const endStr = endHour === 24 ? "24:00" : `${String(endHour).padStart(2, "0")}:00`;

    createBulk.mutate(
      selectedDays.map((day) => ({
        user_id: userId,
        store_id: storeId,
        day_of_week: day,
        start_time: startStr,
        end_time: endStr,
        availability_type: "available" as const,
      })),
      {
        onSuccess: () => {
          setShowForm(false);
          setSelectedDays([]);
          setStartHour(null);
          setEndHour(null);
        },
      }
    );
  };

  // Group by day
  const grouped = new Map<number, typeof availability>();
  availability?.forEach((a) => {
    const list = grouped.get(a.day_of_week) ?? [];
    list.push(a);
    grouped.set(a.day_of_week, list);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Orario personalizzato</Label>
      </div>

      {!hasCustomSchedule && !showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Nessun orario personalizzato configurato. Il dipendente è considerato <strong>sempre disponibile</strong> per le ore del suo contratto.
          </p>
        </div>
      )}

      {/* Existing schedule entries */}
      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
        const slots = grouped.get(day);
        if (!slots) return null;
        return (
          <div key={day} className="rounded-lg border border-border p-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">
              {DAY_LABELS[day]}
            </p>
            <div className="space-y-1">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                  </Badge>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteAvail.mutate({ id: slot.id, userId })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Add button */}
      {canEdit && !showForm && (
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          {hasCustomSchedule ? "Aggiungi fascia" : "Configura orario personalizzato"}
        </Button>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
          <div className="space-y-1.5">
            <Label className="text-xs">Giorni</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS_SHORT.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "h-8 w-10 rounded-md text-[11px] font-medium border transition-colors",
                    selectedDays.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Inizio</Label>
            <div className="grid grid-cols-6 gap-1">
              {HOURS_GRID.filter((h) => h < 24).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setStartHour(h)}
                  className={cn(
                    "h-7 rounded text-[11px] font-mono border transition-colors",
                    startHour === h
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Fine</Label>
            <div className="grid grid-cols-6 gap-1">
              {HOURS_GRID.filter((h) => h > 0).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setEndHour(h)}
                  className={cn(
                    "h-7 rounded text-[11px] font-mono border transition-colors",
                    endHour === h
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {h === 24 ? "24" : String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleApply} disabled={createBulk.isPending} className="flex-1">
              Applica
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setSelectedDays([]); setStartHour(null); setEndHour(null); }}>
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Admin Reset Password ─── */
function AdminResetPasswordButton({ targetUserId }: { targetUserId: string }) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  if (role !== "super_admin" && role !== "admin") return null;

  const handleReset = async () => {
    if (newPw.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri");
      return;
    }
    setLoading(true);
    const res = await supabase.functions.invoke("admin-reset-password", {
      body: { target_user_id: targetUserId, new_password: newPw },
    });
    setLoading(false);
    if (res.error) {
      toast.error("Errore: " + (res.error.message || "Errore sconosciuto"));
    } else {
      toast.success("Password aggiornata con successo");
      setOpen(false);
      setNewPw("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setNewPw(""); setShowPw(false); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2 mt-2">
          <KeyRound className="h-4 w-4" />
          Cambia password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambia password utente</DialogTitle>
          <DialogDescription>
            Imposta una nuova password per questo utente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-pw" className="text-xs font-medium">Nuova password</Label>
            <div className="relative">
              <Input
                id="admin-pw"
                type={showPw ? "text" : "password"}
                placeholder="Almeno 6 caratteri"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleReset} disabled={loading || newPw.length < 6} className="w-full rounded-xl">
            {loading ? "Salvataggio…" : "Imposta password"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
