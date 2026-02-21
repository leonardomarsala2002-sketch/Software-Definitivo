import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import InviteForm from "@/components/invitations/InviteForm";
import InvitationsTable, { type InvitationStatus } from "@/components/invitations/InvitationsTable";

const statusFilterOptions: { value: InvitationStatus | "all"; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "pending", label: "In attesa" },
  { value: "accepted", label: "Accettati" },
  { value: "expired", label: "Scaduti" },
  { value: "revoked", label: "Revocati" },
];

export default function Invitations() {
  const { role, stores } = useAuth();
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | "all">("all");

  // Fetch invitations with invited_by profile join
  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch stores for name lookup
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
  const storeMap = new Map(storeOptions.map((s) => [s.id, s.name]));

  // Collect unique invited_by IDs and fetch profiles
  const inviterIds = [...new Set(invitations.map((i) => i.invited_by).filter(Boolean))] as string[];

  const { data: inviterProfiles = [] } = useQuery({
    queryKey: ["inviter-profiles", inviterIds],
    enabled: inviterIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", inviterIds);
      if (error) throw error;
      return data;
    },
  });

  const inviterMap = new Map(inviterProfiles.map((p) => [p.id, p.full_name ?? "—"]));

  return (
    <div className="space-y-8">
      <PageHeader title="Inviti" subtitle="Invita nuovi utenti nella piattaforma." />

      <InviteForm />

      {/* Invitations Table */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold">Inviti recenti</CardTitle>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as InvitationStatus | "all")}
          >
            <SelectTrigger className="w-[160px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <InvitationsTable
            invitations={invitations as any}
            isLoading={isLoading}
            storeMap={storeMap}
            inviterMap={inviterMap}
            statusFilter={statusFilter}
          />
        </CardContent>
      </Card>
    </div>
  );
}
