import { Inbox } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const Requests = () => (
  <div>
    <PageHeader
      title="Richieste"
      subtitle="Ferie, permessi, cambi turno e malattie"
    />
    <EmptyState
      icon={<Inbox className="h-6 w-6" />}
      title="Nessuna richiesta"
      description="Le richieste di ferie, permessi e cambi turno appariranno qui."
    />
  </div>
);

export default Requests;
