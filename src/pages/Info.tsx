import { Info as InfoIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

const Info = () => (
  <div>
    <PageHeader
      title="Informazioni"
      subtitle="Dettagli sull'applicazione e contatti di supporto"
    />
    <Card>
      <CardContent className="py-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <InfoIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">Ristorante Shift Scheduler</h3>
          <p className="mb-4 text-sm text-muted-foreground">Versione 1.0.0</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Gestione intelligente dei turni per catene di ristoranti. 
            Generazione automatica, separazione sala/cucina, multi-store.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default Info;
