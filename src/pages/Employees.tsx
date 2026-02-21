import { Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const Employees = () => (
  <div>
    <PageHeader
      title="Dipendenti"
      subtitle="Gestisci il personale, i ruoli e le assegnazioni agli store"
    />
    <EmptyState
      icon={<Users className="h-6 w-6" />}
      title="Nessun dipendente"
      description="Aggiungi i dipendenti per iniziare a pianificare i turni."
    />
  </div>
);

export default Employees;
