import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Send, Mail } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  employee: "Dipendente",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  accepted: "default",
  expired: "secondary",
};

export default function Invitations() {
  const { role, stores, user } = useAuth();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const [selectedStoreId, setSelectedStoreId] = useState("");

  // Roles the user can assign
  const assignableRoles: AppRole[] =
    role === "super_admin" ? ["admin", "employee"] : ["employee"];

  // Stores available in the selector
  const availableStores = stores;

  // Fetch invitations
  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch all stores for super_admin (they might have more stores than assigned)
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

  const storeOptions = role === "super_admin" ? allStores : availableStores;

  // Store name lookup map
  const storeMap = new Map(storeOptions.map((s) => [s.id, s.name]));

  const createInvitation = useMutation({
    mutationFn: async () => {
      if (!email.trim()) throw new Error("Inserisci un'email");
      if (!selectedRole) throw new Error("Seleziona un ruolo");
      if (!selectedStoreId) throw new Error("Seleziona uno store");

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) throw new Error("Email non valida");

      const { error } = await supabase.from("invitations").insert({
        email: email.trim().toLowerCase(),
        role: selectedRole as AppRole,
        store_id: selectedStoreId,
        invited_by: user?.id ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invito creato con successo!");
      setEmail("");
      setSelectedRole("");
      setSelectedStoreId("");
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiato negli appunti!");
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Inviti" subtitle="Invita nuovi utenti nella piattaforma." />

      {/* Invite Form */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Mail className="h-4 w-4 text-primary" />
            Nuovo invito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Invitations Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">
            Inviti recenti
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Caricamento...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                Nessun invito trovato.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Ruolo</TableHead>
                    <TableHead className="text-xs">Store</TableHead>
                    <TableHead className="text-xs">Stato</TableHead>
                    <TableHead className="text-xs">Scadenza</TableHead>
                    <TableHead className="text-xs">Creato</TableHead>
                    <TableHead className="text-xs w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm font-medium">
                        {inv.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px]">
                          {roleLabels[inv.role as AppRole] ?? inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.store_id
                          ? storeMap.get(inv.store_id) ?? "—"
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariant[inv.status] ?? "outline"}
                          className="text-[11px] capitalize"
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(inv.expires_at), "d MMM yyyy", {
                          locale: it,
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(inv.created_at), "d MMM yyyy HH:mm", {
                          locale: it,
                        })}
                      </TableCell>
                      <TableCell>
                        {inv.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyInviteLink(inv.token)}
                            className="h-8 w-8 p-0"
                            title="Copia link invito"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
