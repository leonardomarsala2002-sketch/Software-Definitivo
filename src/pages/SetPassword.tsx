import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Wait for Supabase to process the hash fragment (invite/recovery token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setHasSession(true);
          setChecking(false);
        }
      }
    );

    // Also check if there's already a session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Le password non corrispondono");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error("Errore: " + error.message);
    } else {
      toast.success("Password impostata! Benvenuto.");
      navigate("/", { replace: true });
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Link non valido</h1>
          <p className="text-sm text-muted-foreground">
            Il link è scaduto o non valido. Richiedi un nuovo invito.
          </p>
          <Button onClick={() => navigate("/login", { replace: true })} className="rounded-xl">
            Vai al Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Imposta la tua password
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Scegli una password per accedere a Shift Scheduler
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
          <form onSubmit={handleSetPassword} className="space-y-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-xs font-medium">
                Nuova password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Almeno 6 caratteri"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs font-medium">
                Conferma password
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Ripeti la password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full rounded-xl text-[14px] font-semibold"
            >
              {loading ? "Salvataggio…" : "Imposta password"}
            </Button>
          </form>
        </div>

        <p className="text-[10px] text-muted-foreground/50">
          © 2026 Shift Scheduler
        </p>
      </div>
    </div>
  );
}
