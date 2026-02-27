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
  fitness_score: number | null;
  iterations_run: number | null;
  hour_adjustments: Record<string, number> | null;
  suggestions: any[] | null;
  accepted_gaps: string[] | null;
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
    mutationFn: async (params: { store_id: string; department?: "sala" | "cucina"; week_start: string; mode?: "full" | "patch"; affected_user_id?: string }) => {
      const { data, error } = await supabase.functions.invoke("generate-optimized-schedule", {
        body: { store_id: params.store_id, week_start_date: params.week_start, mode: params.mode, affected_user_id: params.affected_user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["generation-runs"] });
      qc.invalidateQueries({ queryKey: ["generation-run-suggestions"] });
      qc.invalidateQueries({ queryKey: ["lending-suggestions"] });
      const depts = data?.departments ?? [];
      const totalUncovered = depts.reduce((acc: number, d: any) => acc + (d.uncovered ?? 0), 0);
      if (totalUncovered > 0) {
        toast.warning(`Turni generati con ${totalUncovered} slot non coperti. Controlla i suggerimenti nel pannello Health Check.`);
      } else {
        const totalShifts = depts.reduce((acc: number, d: any) => acc + (d.shifts ?? 0), 0);
        toast.success(`Turni generati: ${totalShifts} turni`);
      }
    },
    onError: (err: any) => toast.error(err.message ?? "Errore generazione turni"),
  });
}

export function usePublishWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { store_id: string; week_start: string }) => {
      const { data, error } = await supabase.functions.invoke("publish-shifts", {
        body: params,
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

export function useApprovePatchShifts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { store_id: string; week_start: string; generation_run_ids?: string[] }) => {
      const { data, error } = await supabase.functions.invoke("approve-patch-shifts", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["generation-runs"] });
      toast.success(`${data?.published ?? 0} turni approvati e notifiche inviate a ${data?.affected_users ?? 0} dipendenti`);
    },
    onError: (err: any) => toast.error(err.message ?? "Errore approvazione turni"),
  });
}
