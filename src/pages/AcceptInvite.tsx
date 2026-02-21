import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UtensilsCrossed,
  LogIn,
  AlertTriangle,
  LogOut,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  employee: "Dipendente",
};

interface InviteData {
  email: string;
  role: AppRole;
  store_name: string | null;
  status: string;
  expires_at: string;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAuthorized, signOut, refreshUserData } = useAuth();

  const token = searchParams.get("token");

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // 1. Fetch invitation details by token
  useEffect(() => {
    if (!token) {
      setError("Token mancante.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Use a public-safe query — RLS allows reading own invitations by email,
        // but for unauthenticated users we use a service-side edge function.
        // However the trigger approach means we just need to display info.
        // We'll query directly — if user isn't logged in RLS will block,
        // so we use the anon key to fetch via a simple select with token match.
        const { data, error: fetchErr } = await supabase
          .from("invitations")
          .select("email, role, status, expires_at, store_id, stores(name)")
          .eq("token", token)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (!data) {
          setError("Invito non trovato.");
          setLoading(false);
          return;
        }

        if (data.status !== "pending") {
          setError("Questo invito è già stato utilizzato.");
          setLoading(false);
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setError("Questo invito è scaduto.");
          setLoading(false);
          return;
        }

        setInvite({
          email: data.email,
          role: data.role as AppRole,
          store_name: (data.stores as any)?.name ?? null,
          status: data.status,
          expires_at: data.expires_at,
        });
      } catch (err: any) {
        console.error("Error fetching invite:", err);
        setError("Invito non valido o scaduto.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // 2. After login redirect: user is now logged in, trigger check
  useEffect(() => {
    if (authLoading || !user || !token || loading) return;

    // The trigger `handle_invitation_acceptance` fires on profile INSERT (new user signup).
    // For existing users, we need to wait a moment then refresh.
    // Give a small delay for trigger to execute, then reload auth data.
    const handlePostLogin = async () => {
      setAccepting(true);
      // Wait for trigger to process
      await new Promise((r) => setTimeout(r, 1500));
      await refreshUserData(user.id);
    };

    // Only auto-accept if invite is valid and user is logged in but not yet authorized
    if (invite && !isAuthorized) {
      handlePostLogin();
    }
  }, [authLoading, user, token, invite, isAuthorized, loading, refreshUserData]);

  // 3. After refresh, check authorization
  useEffect(() => {
    if (accepting && !authLoading && user) {
      if (isAuthorized) {
        toast.success("Invito accettato! Benvenuto.");
        navigate("/", { replace: true });
      }
      // If still not authorized after refresh, show error (handled in render)
    }
  }, [accepting, authLoading, isAuthorized, user, navigate]);

  const handleGoogleLogin = async () => {
    if (!token) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/invite?token=${token}`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      toast.error("Errore durante il login: " + error.message);
    }
  };

  // --- Render ---

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <UtensilsCrossed className="h-7 w-7 animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Caricamento invito...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Invito non valido
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/login", { replace: true })}
            className="gap-2 rounded-xl"
          >
            <LogIn className="h-4 w-4" />
            Vai al Login
          </Button>
        </div>
      </div>
    );
  }

  // User is logged in, accepting invite but still not authorized
  if (user && accepting && !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Invito non applicato
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                L'invito non è stato applicato al tuo account. Verifica che
                l'email corrisponda o contatta un amministratore.
              </p>
            </div>
          </div>
          <Button
            onClick={signOut}
            variant="outline"
            className="gap-2 rounded-xl"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </div>
      </div>
    );
  }

  // User logged in & authorized → redirect (safety net)
  if (user && isAuthorized) {
    toast.success("Invito accettato!");
    navigate("/", { replace: true });
    return null;
  }

  // Valid invite, not logged in — show invite details + CTA
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sei stato invitato!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Accedi con Google per unirti al team.
            </p>
          </div>
        </div>

        {/* Invite details card */}
        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-3 text-left">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </p>
                <p className="text-sm font-medium text-foreground">
                  {invite!.email}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Ruolo
                </p>
                <Badge variant="secondary" className="mt-0.5 text-[11px]">
                  {roleLabels[invite!.role]}
                </Badge>
              </div>
              {invite!.store_name && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Store
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {invite!.store_name}
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={handleGoogleLogin}
              size="lg"
              className="w-full gap-3 rounded-xl text-[14px] font-semibold"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continua con Google
            </Button>
          </CardContent>
        </Card>

        <p className="text-[10px] text-muted-foreground/50">
          © 2026 Shift Scheduler
        </p>
      </div>
    </div>
  );
}
