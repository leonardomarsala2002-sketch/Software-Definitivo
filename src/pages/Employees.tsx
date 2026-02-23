import { useState, useMemo } from "react";
import { Users, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeList, isEmployeeReady, type EmployeeRow } from "@/hooks/useEmployees";
import EmployeeDetailDrawer from "@/components/employees/EmployeeDetailDrawer";
import InviteEmployeeDialog from "@/components/employees/InviteEmployeeDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StoreMultiSelect } from "@/components/StoreMultiSelect";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext } from "react-router-dom";

interface OutletContextType {
  accentColor: string;
  accentBorders: Record<string, string>;
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const Employees = () => {
  const { role, user, stores: authStores, activeStore } = useAuth();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

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
  const canInvite = role === "super_admin" || role === "admin";

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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Dipendenti</h1>
              <p className="text-xs text-muted-foreground">Gestisci il personale, i ruoli e le assegnazioni agli store</p>
            </div>
          </div>
          {canInvite && (
            <Button
              onClick={() => setInviteDialogOpen(true)}
              className="gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white shrink-0 transition-all duration-300"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Invita</span>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 flex-1 overflow-auto">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Errore caricamento"
            description={error instanceof Error ? error.message : "Si è verificato un errore"}
          />
        </div>
      ) : employees && employees.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Nessun dipendente"
            description="Aggiungi i dipendenti per iniziare a pianificare i turni."
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Filters + summary */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-2xl"
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full sm:w-40 rounded-2xl">
                <SelectValue placeholder="Reparto" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">Tutti i reparti</SelectItem>
                <SelectItem value="sala">Sala</SelectItem>
                <SelectItem value="cucina">Cucina</SelectItem>
              </SelectContent>
            </Select>
            {role === "super_admin" && allStores.length > 0 && (
              <StoreMultiSelect
                stores={allStores}
                selectedIds={storeIds ?? []}
                onChange={setSelectedStoreIds}
              />
            )}
            <Badge variant="secondary" className="text-xs whitespace-nowrap hidden sm:inline-flex rounded-full px-3">
              {readyCount}/{filtered.length} pronti
            </Badge>
          </div>

          {/* Table */}
          <div className="rounded-[24px] border border-border/40 bg-card shadow-bento overflow-hidden flex-1 min-h-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Dipendente</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Reparto</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Ore</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Store</TableHead>
                  <TableHead className="text-xs text-right">Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TooltipProvider delayDuration={200}>
                  {filtered.map((emp) => {
                    const ready = isEmployeeReady(emp);
                    return (
                      <TableRow
                        key={emp.user_id}
                        className="cursor-pointer transition-colors duration-300"
                        onClick={() => handleRowClick(emp)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={emp.avatar_url ?? undefined} />
                              <AvatarFallback className="bg-accent text-accent-foreground text-[11px] font-semibold">
                                {getInitials(emp.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{emp.full_name ?? "—"}</p>
                              <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary" className="text-[11px] capitalize rounded-full">
                            {emp.department}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-foreground">{emp.weekly_contract_hours}h</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">{emp.primary_store_name ?? "—"}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
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
                              <TooltipContent side="left" className="text-xs rounded-xl">
                                {ready ? "Pronto per generazione" : "Dati incompleti (contratto/disponibilità)"}
                              </TooltipContent>
                            </Tooltip>
                            <Badge
                              variant={emp.is_active ? "default" : "outline"}
                              className={`text-[11px] rounded-full ${emp.is_active ? "" : "text-muted-foreground"}`}
                            >
                              {emp.is_active ? "Attivo" : "Inattivo"}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TooltipProvider>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      Nessun risultato per i filtri selezionati
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <EmployeeDetailDrawer
        employee={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        canEdit={canEdit && (selected?.user_id !== user?.id || role === "super_admin")}
      />

      <InviteEmployeeDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  );
};

export default Employees;
