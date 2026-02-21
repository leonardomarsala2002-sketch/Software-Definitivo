import { Settings } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const StoreSettings = () => (
  <div>
    <PageHeader
      title="Impostazioni Store"
      subtitle="Regole dei turni, coperture e configurazione sala/cucina"
    />
    <EmptyState
      icon={<Settings className="h-6 w-6" />}
      title="Nessuna configurazione"
      description="Configura le regole dello store per abilitare la generazione automatica dei turni."
    />
  </div>
);

export default StoreSettings;
