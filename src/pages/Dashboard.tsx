import { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  Users, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, ArrowDownRight, ChevronRight,
  Euro, Calendar, XCircle, Inbox, User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeList } from "@/hooks/useEmployees";
import { useMyRequests } from "@/hooks/useRequests";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { toast } from "sonner";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/* ─── helpers ─────────────────────────────────────────────────────── */

function getWeekDatesISO() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
}

/* ─── KPI Card ─────────────────────────────────────────────────────── */

interface KpiProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  delta?: number;
  deltaLabel?: string;
  href?: string;
}

function KpiCard({ label, value, icon, iconColor, iconBg, delta, deltaLabel, href }: KpiProps) {
  const positive = (delta ?? 0) >= 0;
  const inner = (
    <div className="group relative flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBg)}>
          <span className={cn("h-5 w-5", iconColor)}>{icon}</span>
        </span>
        {href && (
          <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-indigo-400" />
        )}
      </div>
      <div>
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1.5">
          {positive ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
          )}
          <span className={cn("text-[12px] font-semibold", positive ? "text-emerald-600" : "text-red-500")}>
            {positive ? "+" : ""}{delta}%
          </span>
          {deltaLabel && <span className="text-[11px] text-slate-400">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
  return href ? <Link to={href} className="block">{inner}</Link> : inner;
}

/* ─── Status badge ─────────────────────────────────────────────────── */

const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "In attesa", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Approvata", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rifiutata", cls: "bg-red-100 text-red-600" },
};

const REQUEST_TYPE: Record<string, string> = {
  ferie: "Ferie",
  permesso: "Permesso",
  malattia: "Malattia",
  mattina_libera: "Mattina libera",
  sera_libera: "Sera libera",
  giorno_libero: "Giorno libero",
};

/* ─── Employee Dashboard ────────────────────────────────────────────── */

const MONTHS_IT_EMP = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const DAYS_EMP = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];

function fmtDateEmp(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAYS_EMP[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_IT_EMP[d.getUTCMonth()]}`;
}

const EMP_REQUEST_TYPE: Record<string, string> = {
  ferie: "Ferie", permesso: "Permesso", malattia: "Malattia",
  mattina_libera: "Mattina libera", sera_libera: "Sera libera",
  giorno_libero: "Giorno libero", morning_off: "Mattina libera",
  evening_off: "Sera libera", full_day_off: "Giorno libero",
};

const EMP_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: "In attesa",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approvata",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rifiutata",  cls: "bg-red-50 text-red-600 border-red-200" },
};

function EmployeeDashboard() {
  const { user, activeStore, stores: authStores } = useAuth();
  const storeId = activeStore?.id ?? authStores[0]?.id;

  const { data: profile } = useQuery({
    queryKey: ["my-profile-dash", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();
      return data;
    },
  });

  const { data: upcomingShifts = [] } = useQuery({
    queryKey: ["my-shifts-dash", user?.id, storeId],
    enabled: !!user?.id && !!storeId,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, department, is_draft")
        .eq("user_id", user!.id)
        .eq("store_id", storeId!)
        .eq("is_day_off", false)
        .gte("date", today)
        .lte("date", in7)
        .order("date");
      return data ?? [];
    },
  });

  const { data: myRequests = [] } = useMyRequests(user?.id);

  const stats = useMemo(() => ({
    approved: myRequests.filter((r) => r.status === "approved").length,
    pending:  myRequests.filter((r) => r.status === "pending").length,
    ferieDays: myRequests.filter((r) => r.status === "approved" && r.request_type === "ferie").length,
  }), [myRequests]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "Ciao";

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-fade-up">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Ciao, {firstName} 👋</h1>
        <p className="mt-0.5 text-[13px] text-slate-400">Ecco la tua situazione di oggi</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Turni questa settimana", value: upcomingShifts.length, icon: <Calendar className="h-4 w-4" />, color: "text-indigo-600", bg: "bg-indigo-50", href: "/team-calendar" },
          { label: "Richieste approvate",    value: stats.approved,         icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-600", bg: "bg-emerald-50", href: "/requests" },
          { label: "In attesa",              value: stats.pending,          icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-600", bg: "bg-amber-50", href: "/requests" },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.href}
            className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", s.bg, s.color)}>
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900 leading-none">{s.value}</p>
              <p className="mt-0.5 text-[10.5px] text-slate-400 leading-tight">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Upcoming shifts */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[14px] font-bold text-slate-900">I tuoi prossimi turni</h2>
            <Link to="/team-calendar" className="text-[11px] font-medium text-indigo-600 hover:underline">
              Vedi calendario →
            </Link>
          </div>
          {upcomingShifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Calendar className="mb-2 h-8 w-8 text-indigo-200" />
              <p className="text-[13px]">Nessun turno nei prossimi 7 giorni</p>
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
                      <p className="text-[13px] font-semibold text-slate-800">{fmtDateEmp(s.date)}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)} · {isSala ? "Sala" : "Cucina"}
                      </p>
                    </div>
                    {s.is_draft && (
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

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Recent requests */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-[14px] font-bold text-slate-900">Ultime richieste</h2>
              <Link to="/requests" className="text-[11px] font-medium text-indigo-600 hover:underline">
                Tutte →
              </Link>
            </div>
            {myRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Inbox className="mb-2 h-6 w-6 text-indigo-200" />
                <p className="text-[12px]">Nessuna richiesta</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {myRequests.slice(0, 4).map((req) => {
                  const st = EMP_STATUS[req.status] ?? EMP_STATUS["pending"];
                  return (
                    <div key={req.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-800">
                          {EMP_REQUEST_TYPE[req.request_type] ?? req.request_type}
                        </p>
                        <p className="text-[11px] text-slate-400">{req.request_date}</p>
                      </div>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", st.cls)}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
            <h2 className="mb-3 text-[14px] font-bold text-slate-900">Accessi rapidi</h2>
            <div className="flex flex-col gap-2">
              <Link to="/profile" className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-4 py-2.5 text-[12.5px] font-medium text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all">
                <User className="h-4 w-4 text-indigo-400" />Il mio profilo
              </Link>
              <Link to="/requests" className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-4 py-2.5 text-[12.5px] font-medium text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all">
                <Inbox className="h-4 w-4 text-indigo-400" />Invia richiesta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────── */

export default function Dashboard() {
  const { role, activeStore, stores: authStores } = useAuth();

  if (role === "employee") return <EmployeeDashboard />;

  const storeId = activeStore?.id;

  const storeIds = useMemo(() => {
    if (storeId) return [storeId];
    return authStores.map((s) => s.id);
  }, [storeId, authStores]);

  /* Employees */
  const { data: employees = [] } = useEmployeeList(storeIds.length ? storeIds : undefined);

  /* Pending requests */
  const { data: pendingRequests = [], refetch: refetchRequests } = useQuery({
    queryKey: ["pending-requests-dashboard", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("id, request_type, request_date, status, notes, profiles(full_name)")
        .eq("store_id", storeId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* Weekly shifts for coverage chart */
  const weekDates = useMemo(() => getWeekDatesISO(), []);
  const { data: weekShifts = [] } = useQuery({
    queryKey: ["week-shifts-chart", storeId, weekDates[0]],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("date, start_time, end_time, user_id, is_day_off")
        .eq("store_id", storeId!)
        .gte("date", weekDates[0])
        .lte("date", weekDates[6])
        .eq("is_draft", false)
        .eq("is_day_off", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* Critical upcoming shifts (next 48h, draft or missing) */
  const { data: criticalShifts = [] } = useQuery({
    queryKey: ["critical-shifts", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in3days = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, department, is_draft, profiles(full_name)")
        .eq("store_id", storeId!)
        .gte("date", today)
        .lte("date", in3days)
        .eq("is_day_off", false)
        .order("date")
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* Chart data: daily hours from shifts */
  const chartData = useMemo(() => {
    const hoursPerDay = weekDates.map((d) => {
      const dayShifts = weekShifts.filter((s) => s.date === d);
      return dayShifts.reduce((acc, s) => {
        if (!s.start_time || !s.end_time) return acc;
        const sh = parseInt(s.start_time.split(":")[0], 10);
        const eh = parseInt(s.end_time.split(":")[0], 10) || 24;
        return acc + Math.max(0, eh - sh);
      }, 0);
    });
    const maxH = Math.max(...hoursPerDay, 1);
    const coverage = hoursPerDay.map((h) => Math.round((h / maxH) * 100));
    return { labels: DAYS_SHORT, coverage };
  }, [weekShifts, weekDates]);

  /* KPI values */
  const totalEmployees = employees.length;
  const avgCoverage = chartData.coverage.length
    ? Math.round(chartData.coverage.reduce((a, b) => a + b, 0) / chartData.coverage.length)
    : 0;
  const estimatedCost = useMemo(() => {
    const totalH = weekShifts.reduce((acc, s) => {
      if (!s.start_time || !s.end_time) return acc;
      const sh = parseInt(s.start_time.split(":")[0], 10);
      const eh = parseInt(s.end_time.split(":")[0], 10) || 24;
      return acc + Math.max(0, eh - sh);
    }, 0);
    return (totalH * 11.5).toFixed(0);
  }, [weekShifts]);
  const alertCount = pendingRequests.length;

  /* Chart.js config */
  const chartOptions = useMemo<React.ComponentProps<typeof Line>["options"]>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1e1b4b",
        titleColor: "#e0e7ff",
        bodyColor: "#c7d2fe",
        padding: 10,
        cornerRadius: 8,
        callbacks: { label: (ctx) => ` ${ctx.parsed.y}% copertura` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: "#94a3b8", font: { size: 11 } },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: "#f1f5f9" },
        border: { display: false },
        ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => `${v}%` },
      },
    },
    elements: { point: { radius: 4, hoverRadius: 6, backgroundColor: "#4f46e5" }, line: { tension: 0.4 } },
  }), []);

  const chartDataset = useMemo(() => ({
    labels: chartData.labels,
    datasets: [{
      label: "Copertura",
      data: chartData.coverage,
      borderColor: "#4f46e5",
      backgroundColor: "rgba(79,70,229,0.08)",
      borderWidth: 2.5,
      fill: true,
    }],
  }), [chartData]);

  /* Approve/reject request handlers */
  const handleRequest = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("time_off_requests")
      .update({ status })
      .eq("id", id);
    if (error) { toast.error("Errore nell'aggiornamento"); return; }
    toast.success(status === "approved" ? "Richiesta approvata" : "Richiesta rifiutata");
    refetchRequests();
  };

  const canManage = ["super_admin", "admin", "store_manager"].includes(role ?? "");

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-up">

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Dipendenti"
          value={totalEmployees}
          icon={<Users className="h-5 w-5" />}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          delta={4}
          deltaLabel="vs mese scorso"
          href="/employees"
        />
        <KpiCard
          label="Copertura media"
          value={`${avgCoverage}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          delta={avgCoverage > 70 ? 2 : -3}
          deltaLabel="questa settimana"
        />
        <KpiCard
          label="Costi stimati"
          value={`€${Number(estimatedCost).toLocaleString("it-IT")}`}
          icon={<Euro className="h-5 w-5" />}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
          delta={-1}
          deltaLabel="vs settimana scorsa"
        />
        <KpiCard
          label="Alert attivi"
          value={alertCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          href="/requests"
        />
      </div>

      {/* Chart + Requests row */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Coverage chart */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">Andamento Copertura</h2>
              <p className="text-[12px] text-slate-400 mt-0.5">Settimana corrente</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
              {avgCoverage}% media
            </span>
          </div>
          <div className="h-52">
            <Line data={chartDataset} options={chartOptions} />
          </div>
        </div>

        {/* Pending requests */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[14px] font-bold text-slate-900">Richieste in sospeso</h2>
            <Link
              to="/requests"
              className="text-[11px] font-medium text-indigo-600 hover:underline"
            >
              Vedi tutte
            </Link>
          </div>
          <div className="divide-y divide-slate-50 max-h-[232px] overflow-y-auto scrollbar-hide">
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-300" />
                <p className="text-[13px]">Nessuna richiesta in sospeso</p>
              </div>
            ) : (
              pendingRequests.map((req: any) => (
                <div key={req.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-slate-800">
                      {(req.profiles as any)?.full_name ?? "—"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {REQUEST_TYPE[req.request_type] ?? req.request_type} · {fmtDate(req.request_date)}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRequest(req.id, "approved")}
                        className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-100"
                        title="Approva"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRequest(req.id, "rejected")}
                        className="rounded-lg bg-red-50 p-1.5 text-red-500 transition-colors hover:bg-red-100"
                        title="Rifiuta"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      REQUEST_STATUS["pending"].cls
                    )}>
                      {REQUEST_STATUS["pending"].label}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Critical shifts table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-bold text-slate-900">Prossimi turni critici</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {criticalShifts.length}
            </span>
          </div>
          <Link
            to="/team-calendar"
            className="text-[11px] font-medium text-indigo-600 hover:underline"
          >
            Apri scheduler
          </Link>
        </div>

        {criticalShifts.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-slate-400">
            <Calendar className="mb-2 h-8 w-8 text-indigo-200" />
            <p className="text-[13px]">Nessun turno critico nei prossimi 3 giorni</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                  {["Dipendente", "Data", "Orario", "Reparto", "Stato"].map((h) => (
                    <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {criticalShifts.map((s: any) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {(s.profiles as any)?.full_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(s.date)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
                        s.department === "sala"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-orange-100 text-orange-700"
                      )}>
                        {s.department === "sala" ? "Sala" : "Cucina"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {s.is_draft ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-amber-700">
                          Bozza
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                          Pubblicato
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
