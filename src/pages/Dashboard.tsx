import { LayoutDashboard, FlaskConical, Users, Calendar, TrendingUp, Clock } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Errore durante il seed");
    } finally {
      setSeeding(false);
    }
  };

  // Card style classes - Bento style with rounded corners and soft shadows
  const cardBaseClass = "rounded-[1.5rem] border border-border/60 bg-card shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]";
  
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Panoramica generale di tutti gli store e del team"
      />
      
      {/* Bento Grid Layout */}
      <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* Large card - spans 2 columns on larger screens */}
        <Card className={`${cardBaseClass} lg:col-span-2 lg:row-span-2`}>
          <CardHeader className="p-6 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              Panoramica Generale
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center p-6 pt-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <LayoutDashboard className="h-8 w-8" />
            </div>
            <h3 className="mb-1.5 mt-4 text-base font-semibold text-foreground">Nessun dato ancora</h3>
            <p className="max-w-xs text-center text-[13px] leading-relaxed text-muted-foreground">
              I dati della dashboard appariranno qui una volta configurati gli store e i dipendenti.
            </p>
          </CardContent>
        </Card>

        {/* Team Stats Card */}
        <Card className={cardBaseClass}>
          <CardHeader className="p-6 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Users className="h-5 w-5 text-primary" />
              Team
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center p-6 pt-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Users className="h-6 w-6" />
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">Dipendenti attivi</p>
            <p className="text-2xl font-bold text-foreground">--</p>
          </CardContent>
        </Card>

        {/* Calendar Card */}
        <Card className={cardBaseClass}>
          <CardHeader className="p-6 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Calendar className="h-5 w-5 text-primary" />
              Calendario
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center p-6 pt-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Calendar className="h-6 w-6" />
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">Turni questa settimana</p>
            <p className="text-2xl font-bold text-foreground">--</p>
          </CardContent>
        </Card>

        {/* Trends Card - spans 2 columns */}
        <Card className={`${cardBaseClass} md:col-span-2`}>
          <CardHeader className="p-6 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <TrendingUp className="h-5 w-5 text-primary" />
              Statistiche
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center p-6 pt-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <TrendingUp className="h-6 w-6" />
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">Le statistiche saranno disponibili presto</p>
          </CardContent>
        </Card>

        {/* Hours Card */}
        <Card className={cardBaseClass}>
          <CardHeader className="p-6 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Clock className="h-5 w-5 text-primary" />
              Ore Lavorate
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center p-6 pt-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Clock className="h-6 w-6" />
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">Ore totali</p>
            <p className="text-2xl font-bold text-foreground">--</p>
          </CardContent>
        </Card>
      </div>

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
