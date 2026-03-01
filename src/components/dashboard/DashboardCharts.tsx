import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

/* ── Table: Ultime richieste ── */

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "In attesa", className: "bg-warning/15 text-warning border-0" },
  approved: { label: "Approvata", className: "bg-primary/15 text-primary border-0" },
  rejected: { label: "Rifiutata", className: "bg-destructive/15 text-destructive border-0" },
};

function RecentRequestsTable() {
  const { activeStore } = useAuth();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["dashboard-recent-requests", activeStore?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("id, request_type, request_date, status, user_id, department, created_at")
        .eq("store_id", activeStore!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;

      if (!data || data.length === 0) return [];
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "—"]));

      return data.map((r) => ({
        ...r,
        name: nameMap.get(r.user_id) ?? "—",
      }));
    },
    enabled: !!activeStore?.id,
  });

  const typeLabels: Record<string, string> = {
    ferie: "Ferie",
    permesso: "Permesso",
    malattia: "Malattia",
    cambio_turno: "Cambio turno",
  };

  return (
    <Card className="p-4 flex flex-col">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          Ultime richieste
          <Link to="/requests" className="text-xs font-normal text-primary hover:text-primary/80 transition-colors">
            Vedi tutte →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nessuna richiesta recente</p>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>Dipendente</span>
              <span className="w-20 text-center">Tipo</span>
              <span className="w-20 text-center">Data</span>
              <span className="w-20 text-center">Stato</span>
            </div>
            {requests.map((r) => {
              const status = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
              return (
                <div key={r.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors text-sm">
                  <span className="font-medium text-foreground truncate">{r.name}</span>
                  <span className="w-20 text-center text-xs text-muted-foreground">{typeLabels[r.request_type] ?? r.request_type}</span>
                  <span className="w-20 text-center text-xs text-muted-foreground">{r.request_date}</span>
                  <span className="w-20 flex justify-center">
                    <Badge className={`text-[10px] px-1.5 py-0 ${status.className}`}>{status.label}</Badge>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Export ── */

export function DashboardCharts() {
  return <RecentRequestsTable />;
}
