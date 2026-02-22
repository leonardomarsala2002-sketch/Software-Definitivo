import { useState, useMemo } from "react";
import { FileText, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AuditEntry {
  id: string;
  created_at: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
}

function useAuditLogs(storeId: string | undefined) {
  return useQuery({
    queryKey: ["audit-logs", storeId],
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, created_at, user_name, action, entity_type, entity_id, details")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
    enabled: !!storeId,
  });
}

const actionLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  publish: { label: "Pubblicazione", variant: "default" },
  create_shift: { label: "Creazione turno", variant: "secondary" },
  update_shift: { label: "Modifica turno", variant: "outline" },
  delete_shift: { label: "Eliminazione turno", variant: "destructive" },
  generate: { label: "Generazione", variant: "secondary" },
  patch_regenerate: { label: "Rigenerazione", variant: "outline" },
};

const AuditLog = () => {
  const { activeStore } = useAuth();
  const storeId = activeStore?.id;
  const { data: logs = [], isLoading } = useAuditLogs(storeId);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      (l.user_name?.toLowerCase().includes(q)) ||
      l.action.toLowerCase().includes(q) ||
      l.entity_type.toLowerCase().includes(q) ||
      JSON.stringify(l.details ?? {}).toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={`${activeStore?.name ?? "Store"} · Cronologia delle azioni`}
      />

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per nome, azione..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Nessuna attività registrata"
          description="Ogni azione importante verrà tracciata automaticamente qui."
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-2">
            {filtered.map(log => {
              const cfg = actionLabels[log.action] ?? { label: log.action, variant: "outline" as const };
              const ts = parseISO(log.created_at);

              return (
                <Card key={log.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0 h-4">
                          {cfg.label}
                        </Badge>
                        <span className="text-xs font-medium text-foreground">
                          {log.user_name ?? "Sistema"}
                        </span>
                      </div>
                      {log.details && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed truncate">
                          {log.details.description ?? JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(ts, "dd MMM HH:mm", { locale: it })}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default AuditLog;
