import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const isDev =
  window.location.hostname === "localhost" ||
  window.location.hostname.includes("preview") ||
  window.location.hostname.includes("lovable.app");

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthorized, signOut } = useAuth();
  const [bootstrapping, setBootstrapping] = useState(false);

  const handleBootstrap = async () => {
    if (!user) return;
    setBootstrapping(true);
    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-admin");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Super Admin creato! Ricaricamento...");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(err.message || "Errore durante il bootstrap");
      setBootstrapping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <UtensilsCrossed className="h-7 w-7 animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Accesso non abilitato
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Il tuo account non è ancora stato abilitato. Contatta un
                amministratore per ricevere un invito.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={signOut}
              variant="outline"
              className="gap-2 rounded-xl"
            >
              <LogOut className="h-4 w-4" />
              Esci
            </Button>
            {isDev && (
              <Button
                onClick={handleBootstrap}
                variant="secondary"
                disabled={bootstrapping}
                className="gap-2 rounded-xl text-xs"
              >
                <ShieldCheck className="h-4 w-4" />
                {bootstrapping ? "Creazione in corso..." : "Bootstrap Super Admin (solo sviluppo)"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
