import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ShiftRow {
  id: string;
  store_id: string;
  user_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  department: "sala" | "cucina";
  is_day_off: boolean;
  status: "draft" | "published";
  generation_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useMonthShifts(storeId: string | undefined, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return useQuery({
    queryKey: ["shifts", storeId, year, month],
    queryFn: async (): Promise<ShiftRow[]> => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("store_id", storeId!)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as ShiftRow[];
    },
    enabled: !!storeId,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shift: {
      store_id: string;
      user_id: string;
      date: string;
      start_time: string | null;
      end_time: string | null;
      department: "sala" | "cucina";
      is_day_off: boolean;
    }) => {
      const { error } = await supabase.from("shifts").insert(shift as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Turno creato");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore creazione turno"),
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<ShiftRow, "start_time" | "end_time" | "is_day_off">>;
    }) => {
      const { error } = await supabase.from("shifts").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Turno aggiornato");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore aggiornamento turno"),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Turno eliminato");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore eliminazione turno"),
  });
}
