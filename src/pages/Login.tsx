import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, KeyRound, CalendarDays, Users, Clock, Shield } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ForgotPasswordDialog from "@/components/ForgotPasswordDialog";

type LoginMode = "password" | "otp-request" | "otp-verify";

const features = [
  { icon: CalendarDays, text: "Turni generati in secondi con l'AI" },
  { icon: Shield,       text: "Regole contrattuali automatiche"   },
  { icon: Clock,        text: "Gestione mensile con un click"      },
  { icon: Users,        text: "Multi-store, multi-ruolo"           },
];

export default function Login() {
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isLoading && user) return <Navigate to="/" replace />;

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
      toast.error(error.message === "Signups not allowed for otp" ? "Account non trovato. Contatta un amministratore." : error.message);
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
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    setLoading(false);
    if (error) toast.error(error.message.includes("expired") || error.message.includes("invalid") ? "Codice non valido o scaduto." : error.message);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 bg-sky-600">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Shift Scheduler</span>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              Turni intelligenti.<br />Team felice.
            </h2>
            <p className="mt-3 text-sky-100 text-sm leading-relaxed">
              Pianifica e gestisci i turni del tuo ristorante con intelligenza artificiale.
            </p>
          </div>
          <ul className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sky-50 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sky-200 text-xs">© 2026 Shift Scheduler</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-xl font-bold text-slate-900">Shift Scheduler</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900">Accedi</h1>
            <p className="mt-1 text-sm text-slate-500">Accedi al tuo account per continuare</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-7 space-y-5">
            {/* Mode toggle */}
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => { setMode("password"); setOtpCode(""); }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-semibold transition-all ${
                  mode === "password" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" /> Password
              </button>
              <button
                onClick={() => { setMode("otp-request"); setPassword(""); }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-semibold transition-all ${
                  mode !== "password" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Mail className="h-3.5 w-3.5" /> Codice email
              </button>
            </div>

            {/* Password form */}
            {mode === "password" && (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</Label>
                  <Input id="login-email" type="email" placeholder="nome@azienda.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Password</Label>
                  <div className="relative">
                    <Input id="login-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <ForgotPasswordDialog />
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors disabled:opacity-60"
                  >
                    {loading ? (
                      <><span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Accesso…</>
                    ) : "Accedi →"}
                  </button>
                </div>
              </form>
            )}

            {/* OTP request form */}
            {mode === "otp-request" && (
              <form onSubmit={handleOtpRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otp-email" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</Label>
                  <Input id="otp-email" type="email" placeholder="nome@azienda.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">
                  Riceverai un codice a 6 cifre valido per 10 minuti.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors disabled:opacity-60"
                >
                  {loading ? <><span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Invio…</> : "Invia codice →"}
                </button>
              </form>
            )}

            {/* OTP verify form */}
            {mode === "otp-verify" && (
              <form onSubmit={handleOtpVerify} className="space-y-4">
                <div className="rounded-lg bg-sky-50 border border-sky-100 px-4 py-3">
                  <p className="text-xs text-slate-600">Codice inviato a <span className="font-bold text-slate-900">{email}</span></p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="otp-code" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Codice a 6 cifre</Label>
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-[0.5em] font-mono font-bold"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setMode("otp-request"); setOtpCode(""); }} className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    Reinvia
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors disabled:opacity-60"
                  >
                    {loading ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : "Verifica →"}
                  </button>
                </div>
              </form>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400">oppure</span></div>
            </div>

            {/* Google OAuth */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Accedi con Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
