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
import { Send, Mail } from "lucide-react";
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
  const { role, stores, user } = useAuth();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");

  const assignableRoles: AppRole[] =
    role === "super_admin" ? ["admin", "employee"] : ["employee"];

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

  const storeOptions = role === "super_admin" ? allStores : stores;

  const createInvitation = useMutation({
    mutationFn: async () => {
      if (!email.trim()) throw new Error("Inserisci un'email");
      if (!selectedRole) throw new Error("Seleziona un ruolo");
      if (!selectedStoreId) throw new Error("Seleziona uno store");
      if (!selectedDepartment) throw new Error("Seleziona un reparto");

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) throw new Error("Email non valida");

      const { data, error } = await supabase.from("invitations").insert({
        email: email.trim().toLowerCase(),
        role: selectedRole as AppRole,
        store_id: selectedStoreId,
        department: selectedDepartment as Department,
        invited_by: user?.id ?? null,
      }).select("id").single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Send invite email
      try {
        const { error: fnErr } = await supabase.functions.invoke("send-invite-email", {
          body: { invitation_id: data.id },
        });
        if (fnErr) throw fnErr;
        toast.success("Invito creato e email inviata!");
      } catch {
        toast.warning("Invito creato, ma invio email fallito.");
      }
      setEmail("");
      setSelectedRole("");
      setSelectedStoreId("");
      setSelectedDepartment("");
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Mail className="h-4 w-4 text-primary" />
          Nuovo invito
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="email" className="text-xs font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@azienda.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Ruolo</Label>
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as AppRole)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Seleziona ruolo" />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Reparto</Label>
            <Select
              value={selectedDepartment}
              onValueChange={(v) => setSelectedDepartment(v as Department)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Seleziona reparto" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(departmentLabels) as Department[]).map((d) => (
                  <SelectItem key={d} value={d}>
                    {departmentLabels[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Store</Label>
            <Select
              value={selectedStoreId}
              onValueChange={setSelectedStoreId}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Seleziona store" />
              </SelectTrigger>
              <SelectContent>
                {storeOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={() => createInvitation.mutate()}
              disabled={createInvitation.isPending}
              className="w-full gap-2 rounded-xl"
            >
              <Send className="h-4 w-4" />
              {createInvitation.isPending ? "Invio..." : "Invia invito"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
