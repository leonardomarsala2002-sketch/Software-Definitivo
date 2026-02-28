import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Clock, Check, X, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

/* ── Area chart: Ore lavorate per settimana ── */

const PLACEHOLDER_WEEKS = [
  { week: "Sett 1", sala: 120, cucina: 95 },
  { week: "Sett 2", sala: 135, cucina: 102 },
  { week: "Sett 3", sala: 128, cucina: 98 },
  { week: "Sett 4", sala: 142, cucina: 110 },
  { week: "Sett 5", sala: 138, cucina: 105 },
  { week: "Sett 6", sala: 145, cucina: 112 },
  { week: "Sett 7", sala: 130, cucina: 100 },
  { week: "Sett 8", sala: 150, cucina: 115 },
];

function HoursAreaChart() {
  return (
    <Card className="p-4 flex flex-col">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          Ore lavorate per settimana
          <span className="ml-auto text-xs font-normal text-muted-foreground">Ultime 8 settimane</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={PLACEHOLDER_WEEKS} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSala" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(152, 100%, 40%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(152, 100%, 40%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCucina" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38, 90%, 50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(38, 90%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 4%, 20%)" />
            <XAxis
              dataKey="week"
              tick={{ fill: "hsl(0, 0%, 56%)", fontSize: 11 }}
              axisLine={{ stroke: "hsl(240, 4%, 20%)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(0, 0%, 56%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(240, 5%, 18%)",
                border: "1px solid hsl(240, 4%, 20%)",
                borderRadius: "12px",
                color: "hsl(0, 0%, 96%)",
                fontSize: "12px",
              }}
            />
            <Area
              type="monotone"
              dataKey="sala"
              name="Sala"
              stroke="hsl(152, 100%, 40%)"
              strokeWidth={2}
              fill="url(#gradSala)"
            />
            <Area
              type="monotone"
              dataKey="cucina"
              name="Cucina"
              stroke="hsl(38, 90%, 50%)"
              strokeWidth={2}
              fill="url(#gradCucina)"
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(152, 100%, 40%)" }} />
            <span className="text-xs text-muted-foreground">Sala</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(38, 90%, 50%)" }} />
            <span className="text-xs text-muted-foreground">Cucina</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Donut chart: Distribuzione sala/cucina ── */

const DEPT_DATA = [
  { name: "Sala", value: 58, color: "hsl(152, 100%, 40%)" },
  { name: "Cucina", value: 42, color: "hsl(38, 90%, 50%)" },
];

function DepartmentDonut() {
  return (
    <Card className="p-4 flex flex-col">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-sm font-semibold">Distribuzione sala / cucina</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col items-center justify-center">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={DEPT_DATA}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {DEPT_DATA.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(240, 5%, 18%)",
                border: "1px solid hsl(240, 4%, 20%)",
                borderRadius: "12px",
                color: "hsl(0, 0%, 96%)",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value}%`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-5 mt-1">
          {DEPT_DATA.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-muted-foreground">{d.name}</span>
              <span className="text-xs font-semibold text-foreground">{d.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Table: Ultime richieste ── */

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "In attesa", className: "bg-warning/15 text-warning border-0" },
  approved: { label: "Approvata", className: "bg-primary/15 text-primary border-0" },
  rejected: { label: "Rifiutata", className: "bg-destructive/15 text-destructive border-0" },
};

function RecentRequestsTable() {
  const { activeStore } = useAuth();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["dashboard-recent-requests", activeStore?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("id, request_type, request_date, status, user_id, department, created_at")
        .eq("store_id", activeStore!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;

      // fetch profile names
      if (!data || data.length === 0) return [];
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "—"]));

      return data.map((r) => ({
        ...r,
        name: nameMap.get(r.user_id) ?? "—",
      }));
    },
    enabled: !!activeStore?.id,
  });

  const typeLabels: Record<string, string> = {
    ferie: "Ferie",
    permesso: "Permesso",
    malattia: "Malattia",
    cambio_turno: "Cambio turno",
  };

  return (
    <Card className="p-4 flex flex-col">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          Ultime richieste
          <Link to="/requests" className="text-xs font-normal text-primary hover:text-primary/80 transition-colors">
            Vedi tutte →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nessuna richiesta recente</p>
        ) : (
          <div className="space-y-0">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>Dipendente</span>
              <span className="w-20 text-center">Tipo</span>
              <span className="w-20 text-center">Data</span>
              <span className="w-20 text-center">Stato</span>
            </div>
            {requests.map((r) => {
              const status = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
              return (
                <div key={r.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors text-sm">
                  <span className="font-medium text-foreground truncate">{r.name}</span>
                  <span className="w-20 text-center text-xs text-muted-foreground">{typeLabels[r.request_type] ?? r.request_type}</span>
                  <span className="w-20 text-center text-xs text-muted-foreground">{r.request_date}</span>
                  <span className="w-20 flex justify-center">
                    <Badge className={`text-[10px] px-1.5 py-0 ${status.className}`}>{status.label}</Badge>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Export ── */

export function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <HoursAreaChart />
      </div>
      <DepartmentDonut />
      <div className="lg:col-span-3">
        <RecentRequestsTable />
      </div>
    </div>
  );
}
