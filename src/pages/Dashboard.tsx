import { useMemo, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  Users, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, ArrowDownRight, ChevronRight,
  Euro, Calendar, XCircle, Inbox, User, CalendarCheck, Store,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeList } from "@/hooks/useEmployees";
import { useMyRequests } from "@/hooks/useRequests";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { DailyPerformanceCard } from "@/components/dashboard/DailyPerformanceCard";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/* ─── helpers ──────────────────────────────────────────────────────── */

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
const DAYS_EMP  = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
}
function fmtDateEmp(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAYS_EMP[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]}`;
}

/* ─── Animated counter ─────────────────────────────────────────────── */

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => `${prefix}${Math.round(v).toLocaleString("it-IT")}${suffix}`);

  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 1, ease: "easeOut" });
    return ctrl.stop;
  }, [value]);

  return <motion.span>{rounded}</motion.span>;
}

/* ─── Fade container ────────────────────────────────────────────────── */

const fadeContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const fadeItem = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

/* ─── KPI Card ─────────────────────────────────────────────────────── */

interface KpiProps {
  label: string;
  numericValue?: number;
  displayValue?: string;
  prefix?: string;
  suffix?: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  delta?: number;
  deltaLabel?: string;
  href?: string;
}

function KpiCard({ label, numericValue, displayValue, prefix = "", suffix = "", icon, iconColor, iconBg, delta, deltaLabel, href }: KpiProps) {
  const positive = (delta ?? 0) >= 0;
  const inner = (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconBg)}>
          <span className={cn("h-4 w-4", iconColor)}>{icon}</span>
        </span>
        {href && <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />}
      </div>
      <div>
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
          {numericValue !== undefined
            ? <AnimatedNumber value={numericValue} prefix={prefix} suffix={suffix} />
            : displayValue}
        </p>
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1.5">
          {positive
            ? <ArrowUpRight className="h-3.5 w-3.5 text-success" />
            : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
          <span className={cn("text-[11px] font-semibold", positive ? "text-success" : "text-destructive")}>
            {positive ? "+" : ""}{delta}%
          </span>
          {deltaLabel && <span className="text-[11px] text-muted-foreground">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
  return href ? <Link to={href} className="block">{inner}</Link> : inner;
}

/* ─── Status maps ───────────────────────────────────────────────────── */

const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: "In attesa", cls: "bg-warning/10 text-warning" },
  approved: { label: "Approvata", cls: "bg-success/10 text-success" },
  rejected: { label: "Rifiutata", cls: "bg-destructive/10 text-destructive" },
};

const REQUEST_TYPE: Record<string, string> = {
  ferie: "Ferie", permesso: "Permesso", malattia: "Malattia",
  mattina_libera: "Mattina libera", sera_libera: "Sera libera",
  giorno_libero: "Giorno libero", morning_off: "Mattina libera",
  evening_off: "Sera libera", full_day_off: "Giorno libero",
};

/* ─── Employee Dashboard ────────────────────────────────────────────── */

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

  const { data: contractDetails } = useQuery({
    queryKey: ["my-contract-dash", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_details")
        .select("weekly_contract_hours")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const contractHours = contractDetails?.weekly_contract_hours ?? 40;

  const { data: upcomingShifts = [] } = useQuery({
    queryKey: ["my-shifts-dash", user?.id, storeId],
    enabled: !!user?.id && !!storeId,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, department, status")
        .eq("user_id", user!.id)
        .eq("store_id", storeId!)
        .eq("is_day_off", false)
        .gte("date", today)
        .lte("date", in7)
        .order("date");
      return data ?? [];
    },
  });

  // Current Mon–Sun week hours
  const currentWeekHours = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const ws = monday.toISOString().split("T")[0];
    const we = sunday.toISOString().split("T")[0];
    return upcomingShifts
      .filter(s => s.date >= ws && s.date <= we && s.start_time && s.end_time)
      .reduce((sum, s) => {
        const sh = parseInt(s.start_time!.split(":")[0], 10);
        const eh = parseInt(s.end_time!.split(":")[0], 10) || 24;
        return sum + Math.max(0, eh - sh);
      }, 0);
  }, [upcomingShifts]);

  const { data: myRequests = [] } = useMyRequests(user?.id);

  // Ferie approvate nell'anno corrente
  const currentYear = new Date().getFullYear();
  const { data: approvedVacations = [] } = useQuery({
    queryKey: ["my-vacations", user?.id, currentYear],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("time_off_requests")
        .select("request_date")
        .eq("user_id", user!.id)
        .eq("request_type", "ferie")
        .eq("status", "approved")
        .gte("request_date", `${currentYear}-01-01`)
        .lte("request_date", `${currentYear}-12-31`);
      return data ?? [];
    },
  });

  const stats = useMemo(() => ({
    approved:     myRequests.filter((r) => r.status === "approved").length,
    pending:      myRequests.filter((r) => r.status === "pending").length,
    ferieDaysUsed: approvedVacations.length,
    ferieRemaining: Math.max(0, 20 - approvedVacations.length),
  }), [myRequests, approvedVacations]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "ciao";

  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-5"
      variants={fadeContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeItem}>
        <h1 className="text-xl font-bold text-foreground">Ciao, {firstName}!</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Ecco la tua situazione di oggi</p>
      </motion.div>

      <motion.div variants={fadeItem} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Turni settimana", value: upcomingShifts.length, icon: <Calendar className="h-4 w-4" />, iconBg: "bg-accent", iconColor: "text-primary", href: "/team-calendar" },
          { label: "Approvate",       value: stats.approved,        icon: <CheckCircle2 className="h-4 w-4" />, iconBg: "bg-success/10", iconColor: "text-success",     href: "/requests" },
          { label: "In attesa",       value: stats.pending,         icon: <AlertTriangle className="h-4 w-4" />, iconBg: "bg-warning/10", iconColor: "text-warning",     href: "/requests" },
          { label: "Ore sett.",       value: currentWeekHours,      icon: <Clock className="h-4 w-4" />, iconBg: currentWeekHours >= contractHours ? "bg-success/10" : "bg-muted", iconColor: currentWeekHours >= contractHours ? "text-success" : "text-muted-foreground", href: "/personal-calendar", suffix: `/${contractHours}h` },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.href}
            className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-3 shadow-card transition-all hover:shadow-card-hover"
          >
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", s.iconBg, s.iconColor)}>
              {s.icon}
            </span>
            <p className="text-xl font-bold text-foreground leading-none">
              <AnimatedNumber value={s.value} />
              {"suffix" in s && s.suffix && (
                <span className="text-[13px] font-medium text-muted-foreground">{s.suffix}</span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
          </Link>
        ))}
      </motion.div>

      <motion.div variants={fadeItem} className="grid gap-4 sm:grid-cols-2">
        {/* Upcoming shifts */}
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-bold text-foreground">Prossimi turni</h2>
            <Link to="/team-calendar" className="text-[11px] font-medium text-primary hover:underline">Calendario →</Link>
          </div>
          {upcomingShifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Calendar className="mb-2 h-7 w-7 text-muted" />
              <p className="text-[12px]">Nessun turno in 7 giorni</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingShifts.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
                    s.department === "sala" ? "bg-accent text-primary" : "bg-warning/10 text-warning"
                  )}>
                    {s.department === "sala" ? "S" : "C"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground">{fmtDateEmp(s.date)}</p>
                    <p className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                    </p>
                  </div>
                  {s.status === "draft" && (
                    <span className="rounded-full border border-dashed border-warning/50 bg-warning/10 px-2 py-0.5 text-[9px] font-medium text-warning">
                      Bozza
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent requests */}
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-bold text-foreground">Ultime richieste</h2>
            <Link to="/requests" className="text-[11px] font-medium text-primary hover:underline">Tutte →</Link>
          </div>
          {myRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Inbox className="mb-2 h-7 w-7 text-muted" />
              <p className="text-[12px]">Nessuna richiesta</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {myRequests.slice(0, 5).map((req) => {
                const st = REQUEST_STATUS[req.status] ?? REQUEST_STATUS["pending"];
                return (
                  <div key={req.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground">
                        {REQUEST_TYPE[req.request_type] ?? req.request_type}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground">{req.request_date}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold", st.cls)}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Saldo ferie */}
      <motion.div variants={fadeItem} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-[13px] font-bold text-foreground flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Saldo Ferie {currentYear}
          </h2>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          {[
            { label: "Giorni spettanti", value: 20, color: "text-foreground", bg: "bg-muted" },
            { label: "Usati", value: stats.ferieDaysUsed, color: "text-warning", bg: "bg-warning/10" },
            { label: "Rimasti", value: stats.ferieRemaining, color: stats.ferieRemaining <= 3 ? "text-destructive" : "text-success", bg: stats.ferieRemaining <= 3 ? "bg-destructive/10" : "bg-success/10" },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center justify-center gap-1 px-3 py-4">
              <span className={cn("text-2xl font-bold", s.color)}>{s.value}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="px-4 pb-3">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, (stats.ferieDaysUsed / 20) * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {stats.ferieDaysUsed} di 20 giorni utilizzati · standard contratto base
          </p>
        </div>
      </motion.div>

      <motion.div variants={fadeItem} className="rounded-xl border border-border bg-card shadow-card p-4">
        <h2 className="mb-2.5 text-[13px] font-bold text-foreground">Accessi rapidi</h2>
        <div className="flex flex-col gap-2">
          {[
            { to: "/profile", icon: <User className="h-3.5 w-3.5 text-primary" />, label: "Il mio profilo" },
            { to: "/requests", icon: <Inbox className="h-3.5 w-3.5 text-primary" />, label: "Invia richiesta" },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="flex items-center gap-2.5 rounded-lg border border-border px-3.5 py-2.5 text-[12px] font-medium text-foreground hover:border-primary/30 hover:bg-accent hover:text-primary transition-all">
              {l.icon}{l.label}
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Admin Dashboard ───────────────────────────────────────────────── */

function AdminDashboard() {
  const { role, activeStore, stores: authStores } = useAuth();
  const storeId = activeStore?.id;

  const storeIds = useMemo(() => {
    if (storeId) return [storeId];
    return authStores.map((s) => s.id);
  }, [storeId, authStores]);

  const { data: employees = [] } = useEmployeeList(storeIds.length ? storeIds : undefined);

  // Super admin: panoramica cross-store
  const { data: crossStore } = useQuery({
    queryKey: ["cross-store-summary"],
    enabled: role === "super_admin",
    queryFn: async () => {
      const [empRes, reqRes, storeRes] = await Promise.all([
        supabase.from("employee_details").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("time_off_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("stores").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      return {
        totalEmployees: empRes.count ?? 0,
        totalPending:   reqRes.count ?? 0,
        totalStores:    storeRes.count ?? 0,
      };
    },
  });

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
        .eq("status", "published")
        .eq("is_day_off", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: criticalShifts = [] } = useQuery({
    queryKey: ["critical-shifts", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in3days = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, department, status, profiles(full_name)")
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
    return { labels: DAYS_SHORT, coverage: hoursPerDay.map((h) => Math.round((h / maxH) * 100)) };
  }, [weekShifts, weekDates]);

  const totalEmployees = employees.length;
  const avgCoverage = chartData.coverage.length
    ? Math.round(chartData.coverage.reduce((a, b) => a + b, 0) / chartData.coverage.length)
    : 0;
  const estimatedCost = useMemo(() => {
    return weekShifts.reduce((acc, s) => {
      if (!s.start_time || !s.end_time) return acc;
      const sh = parseInt(s.start_time.split(":")[0], 10);
      const eh = parseInt(s.end_time.split(":")[0], 10) || 24;
      return acc + Math.max(0, eh - sh);
    }, 0) * 11.5;
  }, [weekShifts]);

  const chartOptions = useMemo<React.ComponentProps<typeof Line>["options"]>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1e293b",
        titleColor: "#e2e8f0",
        bodyColor: "#94a3b8",
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
        min: 0, max: 100,
        grid: { color: "#f1f5f9" },
        border: { display: false },
        ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => `${v}%` },
      },
    },
    elements: {
      point: { radius: 4, hoverRadius: 6, backgroundColor: "hsl(221 83% 53%)" },
      line: { tension: 0.4 },
    },
  }), []);

  const chartDataset = useMemo(() => ({
    labels: chartData.labels,
    datasets: [{
      label: "Copertura",
      data: chartData.coverage,
      borderColor: "hsl(221 83% 53%)",
      backgroundColor: "hsla(221,83%,53%,0.07)",
      borderWidth: 2.5,
      fill: true,
    }],
  }), [chartData]);

  const handleRequest = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("time_off_requests").update({ status }).eq("id", id);
    if (error) { toast.error("Errore nell'aggiornamento"); return; }
    toast.success(status === "approved" ? "Richiesta approvata" : "Richiesta rifiutata");
    refetchRequests();
  };

  const canManage = ["super_admin", "admin", "store_manager"].includes(role ?? "");

  return (
    <motion.div
      className="mx-auto max-w-7xl space-y-5"
      variants={fadeContainer}
      initial="hidden"
      animate="show"
    >
      {/* Super admin: banner cross-store */}
      {role === "super_admin" && crossStore && (
        <motion.div variants={fadeItem} className="flex items-center gap-3 rounded-xl border border-primary/20 bg-accent px-4 py-3">
          <Store className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[12px] text-foreground">
            <span className="font-bold text-primary">{crossStore.totalStores} store attivi</span>
            {" · "}
            <span className="font-bold">{crossStore.totalEmployees}</span>
            <span className="text-muted-foreground"> dipendenti attivi in totale</span>
            {crossStore.totalPending > 0 && (
              <>
                {" · "}
                <span className="font-bold text-warning">{crossStore.totalPending} richieste</span>
                <span className="text-muted-foreground"> in sospeso su tutti i store</span>
              </>
            )}
          </p>
        </motion.div>
      )}

      {/* KPI grid */}
      <motion.div variants={fadeItem} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Dipendenti" numericValue={totalEmployees}
          icon={<Users className="h-4 w-4" />} iconColor="text-primary" iconBg="bg-accent"
          delta={4} deltaLabel="vs mese scorso" href="/employees" />
        <KpiCard label="Copertura media" numericValue={avgCoverage} suffix="%"
          icon={<TrendingUp className="h-4 w-4" />} iconColor="text-success" iconBg="bg-success/10"
          delta={avgCoverage > 70 ? 2 : -3} deltaLabel="questa settimana" />
        <KpiCard label="Costi stimati" numericValue={Math.round(estimatedCost)} prefix="€"
          icon={<Euro className="h-4 w-4" />} iconColor="text-violet-600" iconBg="bg-violet-50"
          delta={-1} deltaLabel="vs sett. scorsa" />
        <KpiCard label="Alert attivi" numericValue={pendingRequests.length}
          icon={<AlertTriangle className="h-4 w-4" />} iconColor="text-warning" iconBg="bg-warning/10"
          href="/requests" />
      </motion.div>

      {/* Chart + Requests */}
      <motion.div variants={fadeItem} className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-bold text-foreground">Andamento Copertura</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Settimana corrente</p>
            </div>
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
              {avgCoverage}% media
            </span>
          </div>
          <div className="h-48">
            <Line data={chartDataset} options={chartOptions} />
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-bold text-foreground">Richieste in sospeso</h2>
            <Link to="/requests" className="text-[11px] font-medium text-primary hover:underline">Vedi tutte</Link>
          </div>
          <div className="divide-y divide-border max-h-[220px] overflow-y-auto scrollbar-hide">
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CheckCircle2 className="mb-2 h-7 w-7 text-success/40" />
                <p className="text-[12px]">Nessuna richiesta in sospeso</p>
              </div>
            ) : (
              pendingRequests.map((req: any) => (
                <div key={req.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[12px] font-semibold text-foreground">
                      {(req.profiles as any)?.full_name ?? "—"}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {REQUEST_TYPE[req.request_type] ?? req.request_type} · {fmtDate(req.request_date)}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRequest(req.id, "approved")}
                        className="rounded-lg bg-success/10 p-1.5 text-success transition-colors hover:bg-success/20"
                        title="Approva"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRequest(req.id, "rejected")}
                        className="rounded-lg bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive/20"
                        title="Rifiuta"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[9px] font-semibold text-warning">
                      In attesa
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* Critical shifts — cards on mobile, table on desktop */}
      <motion.div variants={fadeItem} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-bold text-foreground">Prossimi turni critici</h2>
            {criticalShifts.length > 0 && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">
                {criticalShifts.length}
              </span>
            )}
          </div>
          <Link to="/team-calendar" className="text-[11px] font-medium text-primary hover:underline">Apri scheduler</Link>
        </div>

        {criticalShifts.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground">
            <Calendar className="mb-2 h-7 w-7 text-muted" />
            <p className="text-[12px]">Nessun turno critico nei prossimi 3 giorni</p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="divide-y divide-border md:hidden">
              {criticalShifts.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
                    s.department === "sala" ? "bg-accent text-primary" : "bg-warning/10 text-warning"
                  )}>
                    {s.department === "sala" ? "S" : "C"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">
                      {(s.profiles as any)?.full_name ?? "—"}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {fmtDate(s.date)} · {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-semibold shrink-0",
                    s.status === "draft" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                  )}>
                    {s.status === "draft" ? "Bozza" : "Live"}
                  </span>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left">
                    {["Dipendente", "Data", "Orario", "Reparto", "Stato"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {criticalShifts.map((s: any) => (
                    <tr key={s.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">{(s.profiles as any)?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(s.date)}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-foreground">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          s.department === "sala" ? "bg-accent text-primary" : "bg-warning/10 text-warning"
                        )}>
                          {s.department === "sala" ? "Sala" : "Cucina"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          s.status === "draft" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                        )}>
                          {s.status === "draft" ? "Bozza" : "Pubblicato"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>

      {/* Produttività & Budget — solo se c'è uno store attivo */}
      {storeId && (
        <motion.div variants={fadeItem}>
          <DailyPerformanceCard />
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Root ──────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const { role } = useAuth();
  return role === "employee" ? <EmployeeDashboard /> : <AdminDashboard />;
}
