import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Mail, ChevronDown, ChevronUp } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Department = Database["public"]["Enums"]["department"];

const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  employee: "Dipendente",
};

const departmentLabels: Record<Department, string> = {
  sala: "Sala",
  cucina: "Cucina",
};

export default function InviteForm() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();

  // Base fields
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");

  // Extended fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [weeklyHours, setWeeklyHours] = useState(40);
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [residence, setResidence] = useState("");
  const [domicile, setDomicile] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [level, setLevel] = useState("");
  const [contractType, setContractType] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [showExtended, setShowExtended] = useState(false);

  const assignableRoles: AppRole[] = ["super_admin", "admin", "employee"];

  const { data: allStores = [] } = useQuery({
    queryKey: ["all-stores"],
    enabled: role === "super_admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setEmail("");
    setSelectedRole("");
    setSelectedStoreId("");
    setSelectedDepartment("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setWeeklyHours(40);
    setBirthDate("");
    setBirthPlace("");
    setResidence("");
    setDomicile("");
    setFiscalCode("");
    setHireDate("");
    setLevel("");
    setContractType("");
    setRoleLabel("");
    setShowExtended(false);
  };

  const createInvitation = useMutation({
    mutationFn: async () => {
      if (!email.trim()) throw new Error("Inserisci un'email");
      if (!selectedRole) throw new Error("Seleziona un ruolo");
      const isSuperAdminInvite = selectedRole === "super_admin";
      if (!isSuperAdminInvite && !selectedStoreId) throw new Error("Seleziona uno store");
      if (!isSuperAdminInvite && !selectedDepartment) throw new Error("Seleziona un reparto");

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) throw new Error("Email non valida");

      const _isSA = selectedRole === "super_admin";
      const { data, error } = await supabase.from("invitations").insert({
        email: email.trim().toLowerCase(),
        role: selectedRole as AppRole,
        store_id: _isSA ? null : selectedStoreId,
        department: _isSA ? null : (selectedDepartment as Department),
        invited_by: user?.id ?? null,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        weekly_contract_hours: weeklyHours > 0 ? weeklyHours : 40,
        birth_date: birthDate || null,
        birth_place: birthPlace || null,
        residence: residence || null,
        domicile: domicile || null,
        fiscal_code: fiscalCode || null,
        hire_date: hireDate || null,
        level: level || null,
        contract_type: contractType || null,
        role_label: roleLabel || null,
      } as any).select("id").single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("No session");

        const res = await fetch(
          `https://hzcnvfqbbzkqyvolokvt.supabase.co/functions/v1/send-invite-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ invitation_id: data.id }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        toast.success("Invito creato e email inviata!");
      } catch {
        toast.warning("Invito creato, ma invio email fallito.");
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const isEmployeeInvite = selectedRole === "employee" || selectedRole === "admin";

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Mail className="h-4 w-4 text-primary" />
          Nuovo invito
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: base fields */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="email" className="text-xs font-medium">Email</Label>
            <Input id="email" type="email" placeholder="nome@azienda.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Ruolo</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleziona ruolo" /></SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRole !== "super_admin" && selectedRole !== "" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Reparto</Label>
              <Select value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v as Department)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleziona reparto" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(departmentLabels) as Department[]).map((d) => (
                    <SelectItem key={d} value={d}>{departmentLabels[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedRole !== "super_admin" && selectedRole !== "" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Store</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleziona store" /></SelectTrigger>
                <SelectContent>
                  {allStores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Toggle extended fields for employee invites */}
        {isEmployeeInvite && (
          <button
            type="button"
            onClick={() => setShowExtended(!showExtended)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {showExtended ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showExtended ? "Nascondi dati anagrafici" : "Aggiungi dati anagrafici e contrattuali"}
          </button>
        )}

        {/* Extended fields */}
        {isEmployeeInvite && showExtended && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dati anagrafici e contrattuali</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cognome</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Cognome" className="rounded-xl" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Telefono</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333 1234567" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ore contratto settimanali</Label>
                <Input type="number" min={0} max={80} value={weeklyHours} onChange={(e) => setWeeklyHours(Number(e.target.value))} className="rounded-xl" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Data di nascita</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Luogo di nascita</Label>
                <Input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="Luogo di nascita" className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Codice fiscale</Label>
              <Input value={fiscalCode} onChange={(e) => setFiscalCode(e.target.value.toUpperCase())} placeholder="RSSMRC90A01H501Z" className="rounded-xl font-mono" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Residenza</Label>
                <Input value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="Indirizzo di residenza" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Domicilio</Label>
                <Input value={domicile} onChange={(e) => setDomicile(e.target.value)} placeholder="Indirizzo di domicilio" className="rounded-xl" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data assunzione</Label>
                <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Livello</Label>
                <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="es. 4°" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo contratto</Label>
                <Input value={contractType} onChange={(e) => setContractType(e.target.value)} placeholder="es. Indeterminato" className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ruolo operativo</Label>
              <Input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder="es. Cameriere, Chef de partie" className="rounded-xl" />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => createInvitation.mutate()}
            disabled={createInvitation.isPending}
            className="gap-2 rounded-xl"
          >
            <Send className="h-4 w-4" />
            {createInvitation.isPending ? "Invio..." : "Invia invito"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
