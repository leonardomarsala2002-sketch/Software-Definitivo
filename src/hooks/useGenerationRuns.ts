import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GenerationRun {
  id: string;
  store_id: string;
  department: "sala" | "cucina";
  week_start: string;
  week_end: string;
  status: string;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
  error_message: string | null;
}

export function useWeekGenerationRuns(storeId: string | undefined, weekStart: string | undefined) {
  return useQuery({
    queryKey: ["generation-runs", storeId, weekStart],
    queryFn: async (): Promise<GenerationRun[]> => {
      const { data, error } = await supabase
        .from("generation_runs")
        .select("*")
        .eq("store_id", storeId!)
        .eq("week_start", weekStart!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GenerationRun[];
    },
    enabled: !!storeId && !!weekStart,
  });
}

export function useGenerateShifts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { store_id: string; department: "sala" | "cucina"; week_start: string }) => {
      const { data, error } = await supabase.functions.invoke("generate-shifts", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["generation-runs"] });
      const uncovered = data?.uncovered_slots?.length ?? 0;
      if (uncovered > 0) {
        toast.warning(`Turni generati con ${uncovered} slot non coperti`);
      } else {
        toast.success(`Turni generati: ${data?.shifts_created ?? 0} turni, ${data?.days_off_created ?? 0} riposi`);
      }
    },
    onError: (err: any) => toast.error(err.message ?? "Errore generazione turni"),
  });
}

export function usePublishShifts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (generation_run_id: string) => {
      const { data, error } = await supabase.functions.invoke("publish-shifts", {
        body: { generation_run_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["generation-runs"] });
      toast.success(`${data?.published ?? 0} turni pubblicati e notifiche inviate`);
    },
    onError: (err: any) => toast.error(err.message ?? "Errore pubblicazione turni"),
  });
}
