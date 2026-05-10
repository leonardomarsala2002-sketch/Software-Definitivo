import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ForgotPasswordDialog from "@/components/ForgotPasswordDialog";

type LoginMode = "password" | "otp-request" | "otp-verify";

export default function Login() {
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account", access_type: "offline" },
      },
    });
    if (error) toast.error("Errore login Google: " + error.message);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { toast.error("Inserisci email e password"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) toast.error(error.message === "Invalid login credentials" ? "Credenziali non valide" : error.message);
  };

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Inserisci la tua email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Signups not allowed for otp"
        ? "Account non trovato. Contatta un amministratore."
        : error.message);
    } else {
      toast.success("Codice inviato! Controlla la tua email.");
      setMode("otp-verify");
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.trim();
    if (code.length !== 6) { toast.error("Il codice deve essere di 6 cifre"); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("expired") || error.message.includes("invalid")
        ? "Codice non valido o scaduto. Riprova."
        : error.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 shadow-lg" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Shift Scheduler</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gestione turni per la tua catena di ristoranti</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 space-y-6">

          {/* Mode toggle */}
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            <button
              onClick={() => { setMode("password"); setOtpCode(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${mode === "password" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <KeyRound className="h-3 w-3" /> Password
            </button>
            <button
              onClick={() => { setMode("otp-request"); setPassword(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${mode !== "password" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Mail className="h-3 w-3" /> Codice email
            </button>
          </div>

          {/* Password form */}
          {mode === "password" && (
            <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-xs font-medium">Email</Label>
                <Input id="login-email" type="email" placeholder="nome@azienda.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-xs font-medium">Password</Label>
                <div className="relative">
                  <Input id="login-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <ForgotPasswordDialog />
                <Button type="submit" size="lg" disabled={loading} className="rounded-xl text-[14px] font-semibold px-8">
                  {loading ? "Accesso…" : "Accedi"}
                </Button>
              </div>
            </form>
          )}

          {/* OTP request form */}
          {mode === "otp-request" && (
            <form onSubmit={handleOtpRequest} className="space-y-4 text-left">
              <div className="space-y-2">
                <Label htmlFor="otp-email" className="text-xs font-medium">Email</Label>
                <Input id="otp-email" type="email" placeholder="nome@azienda.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" autoComplete="email" />
              </div>
              <p className="text-xs text-muted-foreground">Riceverai un codice a 6 cifre valido per 10 minuti.</p>
              <Button type="submit" size="lg" disabled={loading} className="w-full rounded-xl text-[14px] font-semibold">
                {loading ? "Invio…" : "Invia codice"}
              </Button>
            </form>
          )}

          {/* OTP verify form */}
          {mode === "otp-verify" && (
            <form onSubmit={handleOtpVerify} className="space-y-4 text-left">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Codice inviato a <span className="font-medium text-foreground">{email}</span></p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp-code" className="text-xs font-medium">Codice a 6 cifre</Label>
                <Input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="rounded-xl text-center text-lg tracking-widest font-mono"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="lg" onClick={() => { setMode("otp-request"); setOtpCode(""); }} className="rounded-xl flex-1 text-xs">
                  Reinvia codice
                </Button>
                <Button type="submit" size="lg" disabled={loading || otpCode.length !== 6} className="rounded-xl flex-1 text-[14px] font-semibold">
                  {loading ? "Verifica…" : "Verifica"}
                </Button>
              </div>
            </form>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">oppure</span></div>
          </div>

          {/* Google */}
          <Button onClick={handleGoogleLogin} variant="outline" size="lg" className="w-full gap-3 rounded-xl text-[14px] font-semibold">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Accedi con Google
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground/50">© 2026 Shift Scheduler</p>
      </div>
    </div>
  );
}
