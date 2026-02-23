import { useState, useMemo } from "react";
import { Users, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeList, isEmployeeReady, type EmployeeRow } from "@/hooks/useEmployees";
import EmployeeDetailDrawer from "@/components/employees/EmployeeDetailDrawer";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StoreMultiSelect } from "@/components/StoreMultiSelect";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const Employees = () => {
  const { role, user, stores: authStores, activeStore } = useAuth();
  const navigate = useNavigate();

  // For super_admin: multi-store select, default to active store
  const { data: allStores = [] } = useQuery({
    queryKey: ["all-stores"],
    enabled: role === "super_admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const [selectedStoreIds, setSelectedStoreIds] = useState<string[] | null>(null);

  // Initialize with active store once available
  const storeIds = useMemo(() => {
    if (role !== "super_admin") return null; // non-super_admin uses default hook behavior
    if (selectedStoreIds !== null) return selectedStoreIds;
    return activeStore ? [activeStore.id] : allStores.map((s) => s.id);
  }, [role, selectedStoreIds, activeStore, allStores]);

  const { data: employees, isLoading, error } = useEmployeeList(role === "super_admin" ? storeIds ?? undefined : undefined);
  const [selected, setSelected] = useState<EmployeeRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const canEdit = role === "super_admin" || role === "admin";

  const filtered = (employees ?? []).filter((e) => {
    const matchesSearch =
      !search ||
      (e.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || e.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const handleRowClick = (emp: EmployeeRow) => {
    if (role === "employee" && emp.user_id !== user?.id) return;
    setSelected(emp);
    setDrawerOpen(true);
  };

  const readyCount = filtered.filter(isEmployeeReady).length;

  const salaEmployees = filtered.filter((e) => e.department === "sala");
  const cucinaEmployees = filtered.filter((e) => e.department === "cucina");

  const EmployeeCard = ({ emp }: { emp: EmployeeRow }) => {
    const ready = isEmployeeReady(emp);
    const isSala = emp.department === "sala";
    return (
      <div
        onClick={() => handleRowClick(emp)}
        className={`flex items-center gap-3 rounded-2xl border p-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
          isSala
            ? "border-orange-200 dark:border-orange-800/40 hover:bg-orange-50/50 dark:hover:bg-orange-900/10"
            : "border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10"
        }`}
      >
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={emp.avatar_url ?? undefined} />
          <AvatarFallback className={`text-[11px] font-semibold ${
            isSala
              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          }`}>
            {getInitials(emp.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{emp.full_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{emp.weekly_contract_hours}h/sett · {emp.primary_store_name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  {ready ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                {ready ? "Pronto per generazione" : "Dati incompleti"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge
            variant={emp.is_active ? "default" : "outline"}
            className={`text-[10px] ${emp.is_active ? "" : "text-muted-foreground"}`}
          >
            {emp.is_active ? "Attivo" : "Inattivo"}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <PageHeader
          title="Dipendenti"
          subtitle="Gestisci il personale, i ruoli e le assegnazioni agli store"
        />
        {(role === "super_admin" || role === "admin") && (
          <Tooltip>
            <TooltipProvider>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/invitations")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg hover:bg-purple-700 transition-all duration-200"
                  aria-label="Nuovo invito"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="font-medium">
                Nuovo invito
              </TooltipContent>
            </TooltipProvider>
          </Tooltip>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Errore caricamento"
          description={error instanceof Error ? error.message : "Si è verificato un errore"}
        />
      ) : employees && employees.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nessun dipendente"
          description="Aggiungi i dipendenti per iniziare a pianificare i turni."
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Filters */}
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap flex-shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Department filter buttons – sidebar-style toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setDeptFilter(deptFilter === "sala" ? "all" : "sala")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  deptFilter === "sala"
                    ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-lg ring-2 ring-orange-400 dark:ring-orange-500"
                    : "bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30"
                }`}
              >
                Sala
              </button>
              <button
                onClick={() => setDeptFilter(deptFilter === "cucina" ? "all" : "cucina")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  deptFilter === "cucina"
                    ? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-lg ring-2 ring-emerald-400 dark:ring-emerald-500"
                    : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                }`}
              >
                Cucina
              </button>
            </div>
            {role === "super_admin" && allStores.length > 0 && (
              <StoreMultiSelect
                stores={allStores}
                selectedIds={storeIds ?? []}
                onChange={setSelectedStoreIds}
              />
            )}
            <Badge variant="secondary" className="text-xs whitespace-nowrap hidden sm:inline-flex">
              {readyCount}/{filtered.length} pronti
            </Badge>
          </div>

          {/* Dual Card System: SALA | CUCINA */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0 overflow-hidden">
            {/* SALA Column */}
            <div className="rounded-[32px] border-2 border-orange-200 dark:border-orange-800/40 bg-card shadow-lg p-4 flex flex-col min-h-0 overflow-hidden transition-all duration-300 hover:shadow-2xl">
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/40">
                  <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <h2 className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Sala</h2>
                <Badge variant="secondary" className="ml-auto text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  {(deptFilter === "all" || deptFilter === "sala") ? salaEmployees.length : 0}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {(deptFilter === "all" || deptFilter === "sala") && salaEmployees.length > 0 ? (
                  salaEmployees.map((emp) => <EmployeeCard key={emp.user_id} emp={emp} />)
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-muted-foreground">Nessun dipendente in Sala</p>
                  </div>
                )}
              </div>
            </div>

            {/* CUCINA Column */}
            <div className="rounded-[32px] border-2 border-emerald-200 dark:border-emerald-800/40 bg-card shadow-lg p-4 flex flex-col min-h-0 overflow-hidden transition-all duration-300 hover:shadow-2xl">
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                  <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Cucina</h2>
                <Badge variant="secondary" className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {(deptFilter === "all" || deptFilter === "cucina") ? cucinaEmployees.length : 0}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {(deptFilter === "all" || deptFilter === "cucina") && cucinaEmployees.length > 0 ? (
                  cucinaEmployees.map((emp) => <EmployeeCard key={emp.user_id} emp={emp} />)
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-muted-foreground">Nessun dipendente in Cucina</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <EmployeeDetailDrawer
        employee={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        canEdit={canEdit && (selected?.user_id !== user?.id || role === "super_admin")}
      />
    </div>
  );
};

export default Employees;
