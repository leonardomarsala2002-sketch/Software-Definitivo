import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, KeyRound, Eye, EyeOff } from "lucide-react";
import type { EmployeeRow } from "@/hooks/useEmployees";
import { isEmployeeReady } from "@/hooks/useEmployees";
import { useUpdateEmployeeDetails } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
          Dati insufficienti per la generazione turni. Verifica: reparto, ore contratto (&gt;0) e almeno 1 fascia di disponibilità.
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

      {canEdit && <AdminResetPasswordButton targetUserId={employee.user_id} />}
    </div>
  );
}

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
