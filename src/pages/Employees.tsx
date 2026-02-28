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

  const canEdit = role === "super_admin";

  // Compute department lists from search filter
  const searchFiltered = (employees ?? []).filter((e) => {
    return (
      !search ||
      (e.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.email ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });
  const salaEmployees = searchFiltered.filter((e) => e.department === "sala");
  const cucinaEmployees = searchFiltered.filter((e) => e.department === "cucina");

  const handleRowClick = (emp: EmployeeRow) => {
    if (role === "employee" && emp.user_id !== user?.id) return;
    setSelected(emp);
    setDrawerOpen(true);
  };

  const readyCount = searchFiltered.filter(isEmployeeReady).length;

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    employee: "Dipendente",
  };

  const EmployeeCard = ({ emp }: { emp: EmployeeRow }) => {
    const ready = isEmployeeReady(emp);
    const isSala = emp.department === "sala";
    const showRole = (role === "super_admin" || role === "admin") && emp.app_role;
    return (
      <div
        onClick={() => handleRowClick(emp)}
        className="rounded-xl border border-border bg-card flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
      >
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={emp.avatar_url ?? undefined} />
          <AvatarFallback className={`text-[11px] font-semibold ${
            isSala
              ? "bg-orange-200 text-orange-800"
              : "bg-[#00C853]/20 text-[#00C853]"
          }`}>
            {getInitials(emp.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{emp.full_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{emp.weekly_contract_hours}h/sett · {emp.primary_store_name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {showRole && (
            <Badge
              variant="outline"
              className={`text-[10px] ${
                emp.app_role === "super_admin"
                  ? "border-primary text-primary"
                  : emp.app_role === "admin"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground"
              }`}
            >
              {roleLabels[emp.app_role!] ?? emp.app_role}
            </Badge>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  {ready ? (
                    <CheckCircle2 className="h-4 w-4 text-[#00C853]" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-[hsl(0,100%,50%)]" />
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
        {role === "super_admin" && (
          <button
            onClick={() => navigate("/invitations")}
            className="rounded-full flex h-10 w-10 items-center justify-center text-primary bg-primary/10 shadow-lg hover:border-2 hover:border-primary transition-all duration-200"
            aria-label="Nuovo invito"
          >
            <Plus className="h-5 w-5" />
          </button>
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
            {role === "super_admin" && allStores.length > 0 && (
              <StoreMultiSelect
                stores={allStores}
                selectedIds={storeIds ?? []}
                onChange={setSelectedStoreIds}
              />
            )}
            <Badge variant="secondary" className="text-xs whitespace-nowrap hidden sm:inline-flex">
              {readyCount}/{searchFiltered.length} pronti
            </Badge>
          </div>

          {/* Dual Card System: SALA | CUCINA */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0 overflow-hidden">
            {/* SALA Column */}
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-200">
                  <Users className="h-4 w-4 text-orange-700" />
                </div>
                <h2 className="text-sm font-bold text-orange-700 uppercase tracking-wide">Sala</h2>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {salaEmployees.length}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
                {salaEmployees.length > 0 ? (
                  salaEmployees.map((emp) => <EmployeeCard key={emp.user_id} emp={emp} />)
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-muted-foreground">Nessun dipendente in Sala</p>
                  </div>
                )}
              </div>
            </div>

            {/* CUCINA Column */}
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00C853]/20">
                  <Users className="h-4 w-4 text-[#00C853]" />
                </div>
                <h2 className="text-sm font-bold text-[#00C853] uppercase tracking-wide">Cucina</h2>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {cucinaEmployees.length}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
                {cucinaEmployees.length > 0 ? (
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
        canEditSchedule={role === "super_admin" || role === "admin"}
      />
    </div>
  );
};

export default Employees;
