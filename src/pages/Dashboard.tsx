import { Users, Calendar, TrendingUp, Clock, CalendarDays, Inbox, FlaskConical } from "lucide-react";
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
      const errorMessage = err instanceof Error ? err.message : "Errore durante il seed";
      toast.error(errorMessage);
    } finally {
      setSeeding(false);
    }
  };

  // Card style classes - Bento style with rounded corners and soft shadows
  const cardBaseClass = "rounded-[1.25rem] border border-border/60 bg-card shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.2)]";
  
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Dashboard"
        subtitle="Panoramica generale di tutti gli store e del team"
      />
      
      {/* Dense Bento Grid Layout - fills available space */}
      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
        {/* Team Stats Card */}
        <Card className={cardBaseClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              Team
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-4 pt-0">
            <p className="text-xs text-muted-foreground">Dipendenti attivi</p>
            <p className="text-3xl font-bold text-foreground">--</p>
          </CardContent>
        </Card>

        {/* Calendar Card */}
        <Card className={cardBaseClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                <CalendarDays className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              Turni
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-4 pt-0">
            <p className="text-xs text-muted-foreground">Questa settimana</p>
            <p className="text-3xl font-bold text-foreground">--</p>
          </CardContent>
        </Card>

        {/* Hours Card */}
        <Card className={cardBaseClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              Ore
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-4 pt-0">
            <p className="text-xs text-muted-foreground">Ore totali</p>
            <p className="text-3xl font-bold text-foreground">--</p>
          </CardContent>
        </Card>

        {/* Requests Card */}
        <Card className={cardBaseClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <Inbox className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Richieste
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-4 pt-0">
            <p className="text-xs text-muted-foreground">In attesa</p>
            <p className="text-3xl font-bold text-foreground">--</p>
          </CardContent>
        </Card>

        {/* Trends Card - spans 2 columns */}
        <Card className={`${cardBaseClass} col-span-2 row-span-2`}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/40">
                <TrendingUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              Statistiche
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center p-4 pt-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <TrendingUp className="h-8 w-8" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Le statistiche saranno disponibili presto
            </p>
          </CardContent>
        </Card>

        {/* Personal Calendar Card */}
        <Card className={`${cardBaseClass} col-span-2 row-span-2`}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
                <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              Calendario Personale
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center p-4 pt-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Calendar className="h-8 w-8" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Il tuo calendario personale apparirà qui
            </p>
          </CardContent>
        </Card>
      </div>

      {import.meta.env.DEV && (
        <div className="mt-4 flex justify-center">
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
