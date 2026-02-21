import { LayoutDashboard, FlaskConical } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

const Dashboard = () => {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Devi essere loggato");
        return;
      }
      const { data, error } = await supabase.functions.invoke("seed-employee-test-data");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message ?? "Dati test creati!");
    } catch (err: any) {
      toast.error(err.message ?? "Errore durante il seed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Panoramica generale di tutti gli store e del team"
      />
      <EmptyState
        icon={<LayoutDashboard className="h-6 w-6" />}
        title="Nessun dato ancora"
        description="I dati della dashboard appariranno qui una volta configurati gli store e i dipendenti."
      />
      {import.meta.env.DEV && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
            className="gap-2 text-muted-foreground"
          >
            <FlaskConical className="h-4 w-4" />
            {seeding ? "Seeding…" : "Seed dati test dipendente"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
