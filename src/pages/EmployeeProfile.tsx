import { useMemo } from "react";
import {
  User, Clock, Calendar, Inbox, CheckCircle2, XCircle, AlertTriangle,
  Building2, Phone, Mail, MapPin, FileText, Briefcase,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRequests } from "@/hooks/useRequests";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";

const MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const DAYS_SHORT = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
}

function fmtDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
}

const REQUEST_TYPE: Record<string, string> = {
  ferie: "Ferie",
  permesso: "Permesso",
  malattia: "Malattia",
  mattina_libera: "Mattina libera",
  sera_libera: "Sera libera",
  giorno_libero: "Giorno libero",
  morning_off: "Mattina libera",
  evening_off: "Sera libera",
  full_day_off: "Giorno libero",
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "In attesa",  cls: "bg-amber-50 text-amber-700 border-amber-200",   icon: <AlertTriangle className="h-3 w-3" /> },
  approved: { label: "Approvata",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "Rifiutata",  cls: "bg-red-50 text-red-600 border-red-200",         icon: <XCircle className="h-3 w-3" /> },
};

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function EmployeeProfile() {
  const { user, activeStore, stores: authStores } = useAuth();
  const storeId = activeStore?.id ?? authStores[0]?.id;

  /* Profile data */
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: details } = useQuery({
    queryKey: ["my-details", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_details")
        .select("department, weekly_contract_hours, phone, hire_date, contract_type, level, role_label, birth_date, residence")
        .eq("user_id", user!.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  /* Upcoming shifts (next 14 days) */
  const { data: upcomingShifts = [] } = useQuery({
    queryKey: ["my-upcoming-shifts", user?.id, storeId],
    enabled: !!user?.id && !!storeId,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, department, status")
        .eq("user_id", user!.id)
        .eq("store_id", storeId!)
        .eq("is_day_off", false)
        .gte("date", today)
        .lte("date", in14)
        .order("date");
      if (error) throw error;
      return data ?? [];
    },
  });

  /* My requests */
  const { data: myRequests = [] } = useMyRequests(user?.id);

  /* Stats */
  const stats = useMemo(() => {
    const approved = myRequests.filter((r) => r.status === "approved").length;
    const pending  = myRequests.filter((r) => r.status === "pending").length;
    const rejected = myRequests.filter((r) => r.status === "rejected").length;
    const ferieDays = myRequests.filter((r) => r.status === "approved" && r.request_type === "ferie").length;
    return { approved, pending, rejected, ferieDays };
  }, [myRequests]);

  const recentRequests = useMemo(() => myRequests.slice(0, 6), [myRequests]);

  const deptLabel = details?.department === "sala" ? "Sala" : details?.department === "cucina" ? "Cucina" : "—";
  const deptColor = details?.department === "sala"
    ? "bg-indigo-100 text-indigo-700"
    : details?.department === "cucina"
    ? "bg-orange-100 text-orange-700"
    : "bg-slate-100 text-slate-500";

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-fade-up">

      {/* Header card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-5">
          <Avatar className="h-16 w-16 shrink-0 ring-2 ring-indigo-100">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className={cn("text-lg font-bold", deptColor)}>
              {getInitials(profile?.full_name ?? null)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">
              {profile?.full_name ?? "Il mio profilo"}
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-400">{profile?.email ?? user?.email}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {details?.department && (
                <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", deptColor)}>
                  {deptLabel}
                </span>
              )}
              {details?.weekly_contract_hours && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
                  {details.weekly_contract_hours}h/sett
                </span>
              )}
              {details?.contract_type && (
                <span className="rounded-full border border-indigo-200 px-3 py-1 text-[11px] font-medium text-indigo-600">
                  {details.contract_type}
                </span>
              )}
              {activeStore?.name && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {activeStore.name}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Turni prossimi", value: upcomingShifts.length, icon: <Calendar className="h-4 w-4" />, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Richieste approvate", value: stats.approved, icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "In attesa", value: stats.pending, icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Giorni ferie usati", value: stats.ferieDays, icon: <Inbox className="h-4 w-4" />, color: "text-violet-600", bg: "bg-violet-50" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", s.bg, s.color)}>
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900 leading-none">{s.value}</p>
              <p className="mt-0.5 text-[10.5px] text-slate-400 leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">

        {/* Upcoming shifts */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[14px] font-bold text-slate-900">Prossimi turni</h2>
            <Link to="/team-calendar" className="text-[11px] font-medium text-indigo-600 hover:underline">
              Calendario team →
            </Link>
          </div>
          {upcomingShifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Calendar className="mb-2 h-8 w-8 text-indigo-200" />
              <p className="text-[13px]">Nessun turno nei prossimi 14 giorni</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {upcomingShifts.map((s) => {
                const isSala = s.department === "sala";
                return (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
                      isSala ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {isSala ? "S" : "C"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800">{fmtDate(s.date)}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                        <span className="mx-1">·</span>
                        {isSala ? "Sala" : "Cucina"}
                      </p>
                    </div>
                    {s.status === "draft" && (
                      <span className="rounded-full border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Bozza
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: info + quick actions */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Contract info */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-[14px] font-bold text-slate-900">Dati contrattuali</h2>
            </div>
            <div className="divide-y divide-slate-50 px-5">
              {[
                { icon: <Briefcase className="h-3.5 w-3.5" />, label: "Contratto", value: details?.contract_type },
                { icon: <User className="h-3.5 w-3.5" />,      label: "Livello",   value: details?.level },
                { icon: <Clock className="h-3.5 w-3.5" />,     label: "Ore/sett",  value: details?.weekly_contract_hours ? `${details.weekly_contract_hours}h` : null },
                { icon: <Calendar className="h-3.5 w-3.5" />,  label: "Assunto il",value: details?.hire_date ? fmtDateShort(details.hire_date) : null },
                { icon: <Mail className="h-3.5 w-3.5" />,      label: "Email",     value: profile?.email },
                { icon: <Phone className="h-3.5 w-3.5" />,     label: "Telefono",  value: details?.phone },
                { icon: <MapPin className="h-3.5 w-3.5" />,    label: "Residenza", value: details?.residence },
              ].filter((r) => r.value).map((row) => (
                <div key={row.label} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                    {row.icon}
                  </span>
                  <span className="text-[11.5px] text-slate-400 w-20 shrink-0">{row.label}</span>
                  <span className="text-[12px] font-medium text-slate-700 truncate">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
            <h2 className="mb-3 text-[14px] font-bold text-slate-900">Azioni rapide</h2>
            <div className="flex flex-col gap-2">
              <Link
                to="/requests"
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-medium text-slate-700 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Inbox className="h-4 w-4 text-indigo-400" />
                Nuova richiesta
              </Link>
              <Link
                to="/team-calendar"
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-medium text-slate-700 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Calendar className="h-4 w-4 text-indigo-400" />
                Vedi calendario team
              </Link>
              <Link
                to="/messages"
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-medium text-slate-700 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <FileText className="h-4 w-4 text-indigo-400" />
                Messaggi
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent requests */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[14px] font-bold text-slate-900">Ultime richieste</h2>
          <Link to="/requests" className="text-[11px] font-medium text-indigo-600 hover:underline">
            Vedi tutte →
          </Link>
        </div>
        {recentRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <Inbox className="mb-2 h-8 w-8 text-indigo-200" />
            <p className="text-[13px]">Nessuna richiesta inviata</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentRequests.map((req) => {
              const s = STATUS_CONFIG[req.status] ?? STATUS_CONFIG["pending"];
              return (
                <div key={req.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">
                      {REQUEST_TYPE[req.request_type] ?? req.request_type}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDateShort(req.request_date)}</p>
                  </div>
                  <span className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold",
                    s.cls
                  )}>
                    {s.icon}
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
