import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, XCircle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
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

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

function resolveStatus(inv: { status: string; expires_at: string }): InvitationStatus {
  if (inv.status === "revoked") return "revoked";
  if (inv.status === "accepted") return "accepted";
  if (inv.status === "pending" && new Date(inv.expires_at) < new Date()) return "expired";
  return "pending";
}

const statusConfig: Record<InvitationStatus, { label: string; className: string }> = {
  pending: { label: "In attesa", className: "bg-amber-100 text-amber-800 border-amber-200" },
  accepted: { label: "Accettato", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  expired: { label: "Scaduto", className: "bg-red-100 text-red-800 border-red-200" },
  revoked: { label: "Revocato", className: "bg-muted text-muted-foreground border-border" },
};

interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  department: Department | null;
  store_id: string | null;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  invited_by: string | null;
}

interface Props {
  invitations: Invitation[];
  isLoading: boolean;
  storeMap: Map<string, string>;
  inviterMap: Map<string, string>;
  statusFilter: InvitationStatus | "all";
}

export default function InvitationsTable({ invitations, isLoading, storeMap, inviterMap, statusFilter }: Props) {
  const queryClient = useQueryClient();

  const filtered = useMemo(() => {
    return invitations.filter((inv) => {
      const resolved = resolveStatus(inv);
      return statusFilter === "all" || resolved === statusFilter;
    });
  }, [invitations, statusFilter]);

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invito revocato.");
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: () => toast.error("Errore durante la revoca."),
  });

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiato negli appunti!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Nessun invito trovato.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Email</TableHead>
            <TableHead className="text-xs">Ruolo</TableHead>
            <TableHead className="text-xs">Reparto</TableHead>
            <TableHead className="text-xs">Store</TableHead>
            <TableHead className="text-xs">Invitato da</TableHead>
            <TableHead className="text-xs">Inviato</TableHead>
            <TableHead className="text-xs">Accettato</TableHead>
            <TableHead className="text-xs">Stato</TableHead>
            <TableHead className="text-xs w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((inv) => {
            const resolved = resolveStatus(inv);
            const cfg = statusConfig[resolved];
            return (
              <TableRow key={inv.id}>
                <TableCell className="text-sm font-medium">{inv.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[11px]">
                    {roleLabels[inv.role] ?? inv.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {inv.department ? departmentLabels[inv.department] : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {inv.store_id ? storeMap.get(inv.store_id) ?? "—" : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {inv.invited_by ? inviterMap.get(inv.invited_by) ?? "—" : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(inv.created_at), "d MMM yyyy", { locale: it })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {inv.accepted_at
                    ? format(new Date(inv.accepted_at), "d MMM yyyy", { locale: it })
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[11px] ${cfg.className}`}>
                    {cfg.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {resolved === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyInviteLink(inv.token)}
                          className="h-8 w-8 p-0"
                          title="Copia link invito"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revokeMutation.mutate(inv.id)}
                          disabled={revokeMutation.isPending}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Revoca invito"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
