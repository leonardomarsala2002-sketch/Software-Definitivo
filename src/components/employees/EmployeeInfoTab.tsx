import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import type { EmployeeRow } from "@/hooks/useEmployees";
import { useUpdateEmployeeDetails } from "@/hooks/useEmployees";

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

  const handleSave = () => {
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="hours" className="text-muted-foreground text-xs uppercase tracking-wider">Ore contratto settimanali</Label>
          <Input
            id="hours"
            type="number"
            min={1}
            max={60}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            disabled={!canEdit}
          />
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
        <Button onClick={handleSave} disabled={!dirty || update.isPending} className="w-full gap-2">
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salva modifiche
        </Button>
      )}
    </div>
  );
}
