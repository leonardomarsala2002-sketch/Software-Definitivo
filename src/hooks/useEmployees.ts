import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface EmployeeRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  department: "sala" | "cucina";
  weekly_contract_hours: number;
  phone: string | null;
  is_active: boolean;
  primary_store_name: string | null;
  primary_store_id: string | null;
  availability_count: number;
}

export interface AvailabilityRow {
  id: string;
  user_id: string;
  store_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  availability_type: "available" | "unavailable";
}

export interface ExceptionRow {
  id: string;
  user_id: string;
  store_id: string;
  exception_type: "ferie" | "permesso" | "malattia" | "modifica_orario" | "altro";
  start_date: string;
  end_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const DAY_LABELS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const DAY_LABELS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export { DAY_LABELS, DAY_LABELS_SHORT };

/** Check if an employee is "ready" for shift generation.
 *  Availability is no longer required — if not configured, employee is always available. */
export function isEmployeeReady(emp: EmployeeRow): boolean {
  return (
    !!emp.department &&
    emp.weekly_contract_hours > 0
  );
}

/**
 * @param filterStoreIds - optional array of store IDs to filter employees by store assignment.
 *   When provided, only employees assigned to at least one of these stores are returned.
 */
export function useEmployeeList(filterStoreIds?: string[]) {
  const { role, stores } = useAuth();
  const storeIds = stores.map((s) => s.id);

  return useQuery({
    queryKey: ["employees", role, storeIds, filterStoreIds],
    queryFn: async (): Promise<EmployeeRow[]> => {
      const { data: details, error: detailsErr } = await supabase
        .from("employee_details")
        .select("user_id, department, weekly_contract_hours, phone, is_active");

      if (detailsErr) throw detailsErr;
      if (!details || details.length === 0) return [];

      const userIds = details.map((d) => d.user_id);

      // Fetch ALL assignments (not just primary) so we can filter by store
      const [profilesRes, allAssignmentsRes, primaryAssignmentsRes, availRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds),
        filterStoreIds && filterStoreIds.length > 0
          ? supabase
              .from("user_store_assignments")
              .select("user_id, store_id")
              .in("user_id", userIds)
              .in("store_id", filterStoreIds)
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("user_store_assignments")
          .select("user_id, store_id, is_primary, stores(name)")
          .in("user_id", userIds)
          .eq("is_primary", true),
        supabase
          .from("employee_availability")
          .select("user_id")
          .in("user_id", userIds),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (allAssignmentsRes.error) throw allAssignmentsRes.error;
      if (primaryAssignmentsRes.error) throw primaryAssignmentsRes.error;

      // Build set of user IDs that match the store filter
      let allowedUserIds: Set<string> | null = null;
      if (filterStoreIds && filterStoreIds.length > 0 && allAssignmentsRes.data) {
        allowedUserIds = new Set(allAssignmentsRes.data.map((a) => a.user_id));
      }

      const profileMap = new Map(profilesRes.data?.map((p) => [p.id, p]) ?? []);
      const storeMap = new Map(
        primaryAssignmentsRes.data?.map((a: any) => [a.user_id, { name: a.stores?.name, id: a.store_id }]) ?? []
      );

      // Count availability records per user
      const availCountMap = new Map<string, number>();
      (availRes.data ?? []).forEach((a) => {
        availCountMap.set(a.user_id, (availCountMap.get(a.user_id) ?? 0) + 1);
      });

      return details
        .filter((d) => !allowedUserIds || allowedUserIds.has(d.user_id))
        .map((d) => {
          const profile = profileMap.get(d.user_id);
          const store = storeMap.get(d.user_id);
          return {
            user_id: d.user_id,
            full_name: profile?.full_name ?? null,
            email: profile?.email ?? null,
            avatar_url: profile?.avatar_url ?? null,
            department: d.department as "sala" | "cucina",
            weekly_contract_hours: d.weekly_contract_hours,
            phone: d.phone,
            is_active: d.is_active,
            primary_store_name: store?.name ?? null,
            primary_store_id: store?.id ?? null,
            availability_count: availCountMap.get(d.user_id) ?? 0,
          };
        });
    },
    enabled: !!role,
  });
}

export function useEmployeeAvailability(userId: string | null) {
  return useQuery({
    queryKey: ["employee-availability", userId],
    queryFn: async (): Promise<AvailabilityRow[]> => {
      const { data, error } = await supabase
        .from("employee_availability")
        .select("*")
        .eq("user_id", userId!)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as AvailabilityRow[];
    },
    enabled: !!userId,
  });
}

export function useEmployeeExceptions(userId: string | null) {
  return useQuery({
    queryKey: ["employee-exceptions", userId],
    queryFn: async (): Promise<ExceptionRow[]> => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("employee_exceptions")
        .select("*")
        .eq("user_id", userId!)
        .gte("end_date", today)
        .order("start_date");
      if (error) throw error;
      return (data ?? []) as ExceptionRow[];
    },
    enabled: !!userId,
  });
}

export function useUpdateEmployeeDetails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: { department?: string; weekly_contract_hours?: number; phone?: string | null; is_active?: boolean };
    }) => {
      const { error } = await supabase
        .from("employee_details")
        .update(updates as any)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Dettagli aggiornati");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore aggiornamento"),
  });
}

export function useBulkCreateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Omit<AvailabilityRow, "id">[]) => {
      const { error } = await supabase.from("employee_availability").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      const userId = vars[0]?.user_id;
      if (userId) qc.invalidateQueries({ queryKey: ["employee-availability", userId] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Disponibilità salvata");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore"),
  });
}

export function useCreateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Omit<AvailabilityRow, "id">) => {
      const { error } = await supabase.from("employee_availability").insert(row as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["employee-availability", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Disponibilità aggiunta");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore"),
  });
}

export function useDeleteAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase.from("employee_availability").delete().eq("id", id);
      if (error) throw error;
      return userId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["employee-availability", vars.userId] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Disponibilità eliminata");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore"),
  });
}

export function useCreateException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Omit<ExceptionRow, "id" | "created_at">) => {
      const { error } = await supabase.from("employee_exceptions").insert(row as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["employee-exceptions", vars.user_id] });
      toast.success("Eccezione aggiunta");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore"),
  });
}

export function useDeleteException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase.from("employee_exceptions").delete().eq("id", id);
      if (error) throw error;
      return userId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["employee-exceptions", vars.userId] });
      toast.success("Eccezione eliminata");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore"),
  });
}
