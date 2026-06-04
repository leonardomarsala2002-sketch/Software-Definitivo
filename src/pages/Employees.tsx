import { useState, useMemo } from "react";
import { Users, CheckCircle2, AlertTriangle, Plus, Search, SlidersHorizontal, UserCheck, UserX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeList, isEmployeeReady, type EmployeeRow } from "@/hooks/useEmployees";
import EmployeeDetailDrawer from "@/components/employees/EmployeeDetailDrawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { StoreMultiSelect } from "@/components/StoreMultiSelect";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const DEPT_CONFIG = {
  sala: { label: "Sala", avatarBg: "bg-accent text-primary", badge: "bg-accent text-primary" },
  cucina: { label: "Cucina", avatarBg: "bg-warning/10 text-warning", badge: "bg-warning/10 text-warning" },
  default: { label: "—", avatarBg: "bg-muted text-muted-foreground", badge: "bg-muted text-muted-foreground" },
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  store_manager: "Manager",
  employee: "Dipendente",
};

type DeptFilter = "all" | "sala" | "cucina";

const Employees = () => {
  const { role, user, stores: authStores, activeStore } = useAuth();
  const navigate = useNavigate();

  const { data: allStores = [] } = useQuery({
    queryKey: ["all-stores"],
    enabled: role === "super_admin",
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const [selectedStoreIds, setSelectedStoreIds] = useState<string[] | null>(null);

  const storeIds = useMemo(() => {
    if (role === "super_admin") {
      if (selectedStoreIds !== null) return selectedStoreIds;
      return activeStore ? [activeStore.id] : allStores.map((s) => s.id);
    }
    if (activeStore) return [activeStore.id];
    return authStores.map((s) => s.id);
  }, [role, selectedStoreIds, activeStore, allStores, authStores]);

  const { data: employees, isLoading, error } = useEmployeeList(storeIds.length > 0 ? storeIds : undefined);
  const [selected, setSelected] = useState<EmployeeRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<DeptFilter>("all");

  const handleRowClick = (emp: EmployeeRow) => {
    if (role === "employee" && emp.user_id !== user?.id) return;
    setSelected(emp);
    setDrawerOpen(true);
  };

  const filtered = useMemo(() => {
    let list = employees ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.full_name ?? "").toLowerCase().includes(q) ||
          (e.email ?? "").toLowerCase().includes(q)
      );
    }
    if (deptFilter !== "all") {
      list = list.filter((e) => e.department === deptFilter);
    }
    return list;
  }, [employees, search, deptFilter]);

  const readyCount = (employees ?? []).filter(isEmployeeReady).length;
  const totalCount = (employees ?? []).length;
  const activeCount = (employees ?? []).filter((e) => e.is_active).length;

  const EmployeeCard = ({ emp }: { emp: EmployeeRow }) => {
    const ready = isEmployeeReady(emp);
    const deptKey = emp.department === "sala" ? "sala" : emp.department === "cucina" ? "cucina" : "default";
    const dept = DEPT_CONFIG[deptKey];
    const canClick = !(role === "employee" && emp.user_id !== user?.id);

    return (
      <div
        onClick={() => canClick && handleRowClick(emp)}
        className={cn(
          "group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-all duration-200",
          canClick ? "cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5" : "opacity-60"
        )}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={emp.avatar_url ?? undefined} />
            <AvatarFallback className={cn("text-[12px] font-bold", dept.avatarBg)}>
              {getInitials(emp.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1.5">
            {/* Ready indicator */}
            <span
              title={ready ? "Pronto per generazione" : "Dati incompleti"}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full",
                ready ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}
            >
              {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            </span>
            {/* Active status */}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                emp.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              {emp.is_active ? "Attivo" : "Inattivo"}
            </span>
          </div>
        </div>

        {/* Info */}
        <div>
          <p className="font-bold text-foreground truncate">{emp.full_name ?? "—"}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground truncate">{emp.email ?? "—"}</p>
        </div>

        {/* Footer badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {emp.department && (
            <span className={cn("rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold", dept.badge)}>
              {dept.label}
            </span>
          )}
          {emp.weekly_contract_hours && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              {emp.weekly_contract_hours}h/sett
            </span>
          )}
          {emp.app_role && role !== "employee" && (
            <span className="rounded-full border border-primary/30 px-2.5 py-0.5 text-[10.5px] font-medium text-primary">
              {ROLE_LABEL[emp.app_role] ?? emp.app_role}
            </span>
          )}
          {emp.primary_store_name && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground truncate max-w-[120px]">
              {emp.primary_store_name}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dipendenti</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {totalCount} totali · {activeCount} attivi · {readyCount} pronti per generazione
          </p>
        </div>
        {role === "super_admin" && (
          <button
            onClick={() => navigate("/invitations")}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Nuovo invito
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o email…"
            className="pl-9 h-9 text-[13px]"
          />
        </div>

        {/* Dept filter pills */}
        <div className="flex items-center gap-1.5 bg-muted rounded-full p-0.5">
          {(["all", "sala", "cucina"] as DeptFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition-all",
                deptFilter === d
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d === "all" ? "Tutti" : d === "sala" ? "Sala" : "Cucina"}
            </button>
          ))}
        </div>

        {/* Store multi-select (super_admin) */}
        {role === "super_admin" && (
          <div className="ml-auto">
            <StoreMultiSelect
              stores={allStores}
              selected={selectedStoreIds ?? []}
              onChange={setSelectedStoreIds}
            />
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Users className="h-4 w-4" />, label: "Totali", value: totalCount, color: "text-primary", bg: "bg-accent" },
          { icon: <UserCheck className="h-4 w-4" />, label: "Attivi", value: activeCount, color: "text-success", bg: "bg-success/10" },
          { icon: <CheckCircle2 className="h-4 w-4" />, label: "Pronti", value: readyCount, color: "text-violet-600", bg: "bg-violet-50" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-card">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", s.bg, s.color)}>
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[148px] w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center rounded-xl border border-border bg-card py-16 text-muted-foreground">
          <AlertTriangle className="mb-3 h-8 w-8 text-red-300" />
          <p className="text-[14px] font-medium">Errore nel caricamento</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-border bg-card py-16 text-muted-foreground">
          <Users className="mb-3 h-8 w-8 text-indigo-200" />
          <p className="text-[14px] font-medium text-slate-500">
            {search || deptFilter !== "all" ? "Nessun risultato" : "Nessun dipendente"}
          </p>
          <p className="mt-1 text-[12px]">
            {search || deptFilter !== "all"
              ? "Prova a modificare i filtri"
              : "Aggiungi dipendenti tramite inviti"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((emp) => (
            <EmployeeCard key={emp.user_id} emp={emp} />
          ))}
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <EmployeeDetailDrawer
          employee={selected}
          open={drawerOpen}
          onOpenChange={(open) => { if (!open) { setDrawerOpen(false); setSelected(null); } }}
          canEdit={role === "super_admin"}
        />
      )}
    </div>
  );
};

export default Employees;
