import { FileText } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const AuditLog = () => (
  <div>
    <PageHeader
      title="Audit Log"
      subtitle="Cronologia di tutte le azioni e modifiche nel sistema"
    />
    <EmptyState
      icon={<FileText className="h-6 w-6" />}
      title="Nessuna attività registrata"
      description="Ogni azione importante verrà tracciata automaticamente qui."
    />
  </div>
);

export default AuditLog;
