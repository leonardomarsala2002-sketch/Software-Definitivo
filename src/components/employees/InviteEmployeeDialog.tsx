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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface InviteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InviteEmployeeDialog({ open, onOpenChange }: InviteEmployeeDialogProps) {
  const { role, stores, user } = useAuth();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");

  const assignableRoles: AppRole[] =
    role === "super_admin" ? ["super_admin", "admin", "employee"] : ["employee"];

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

  const resetForm = () => {
    setEmail("");
    setSelectedRole("");
    setSelectedStoreId("");
    setSelectedDepartment("");
  };

  const createInvitation = useMutation({
    mutationFn: async () => {
      if (!email.trim()) throw new Error("Inserisci un'email");
      if (!selectedRole) throw new Error("Seleziona un ruolo");
      // Super admin non richiede store e reparto
      const isSuperAdminInvite = selectedRole === "super_admin";
      if (!isSuperAdminInvite && !selectedStoreId) throw new Error("Seleziona uno store");
      if (!isSuperAdminInvite && !selectedDepartment) throw new Error("Seleziona un reparto");

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) throw new Error("Email non valida");

      const _isSuperAdmin = selectedRole === "super_admin";
      const { data, error } = await supabase.from("invitations").insert({
        email: email.trim().toLowerCase(),
        role: selectedRole as AppRole,
        store_id: _isSuperAdmin ? null : selectedStoreId,
        department: _isSuperAdmin ? null : (selectedDepartment as Department),
        invited_by: user?.id ?? null,
      }).select("id").single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Send invite email via direct fetch
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
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-purple-600" />
            Invita nuovo dipendente
          </DialogTitle>
          <DialogDescription>
            Inserisci i dati del nuovo dipendente per inviare un invito via email.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-xs font-medium">
              Email
            </Label>
            <Input
              id="invite-email"
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

          {selectedRole !== "super_admin" && (
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
          )}

          {selectedRole !== "super_admin" && (
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
          )}

          <Button
            onClick={() => createInvitation.mutate()}
            disabled={createInvitation.isPending}
            className="w-full gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 mt-2"
          >
            <Send className="h-4 w-4" />
            {createInvitation.isPending ? "Invio in corso..." : "Invia invito"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
