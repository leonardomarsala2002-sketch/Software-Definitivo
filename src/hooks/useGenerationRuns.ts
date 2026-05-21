import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GenerationRun {
  id: string;
  store_id: string;
  department: "sala" | "cucina";
  week_start: string;
  week_end: string;
  period_end: string | null;
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

// Carica i generation_runs per un intero mese (tutti i giorni del periodo)
export function useMonthGenerationRuns(storeId: string | undefined, year: number, month: number) {
  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
  const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return useQuery({
    queryKey: ["generation-runs", storeId, periodStart],
    queryFn: async (): Promise<GenerationRun[]> => {
      const { data, error } = await supabase
        .from("generation_runs")
        .select("*")
        .eq("store_id", storeId!)
        .eq("week_start", periodStart)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GenerationRun[];
    },
    enabled: !!storeId,
    meta: { periodStart, periodEnd },
  });
}

// Backward compat: query by single week_start (usata da codice legacy)
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
    mutationFn: async (params: {
      store_id: string;
      department?: "sala" | "cucina";
      // Mensile
      period_start: string;
      period_end: string;
      mode?: "full" | "patch" | "rebalance";
      affected_user_id?: string;
      locked_shift_ids?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-optimized-schedule", {
        body: {
          store_id:          params.store_id,
          period_start_date: params.period_start,
          period_end_date:   params.period_end,
          mode:              params.mode,
          affected_user_id:  params.affected_user_id,
          locked_shift_ids:  params.locked_shift_ids,
          department:        params.department,
        },
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
      const totalShifts = depts.reduce((acc: number, d: any) => acc + (d.shifts ?? 0), 0);
      if (data?.is_rebalance) {
        toast.success(`Ribilanciamento completato: ${totalShifts} turni rigenerati, ${data?.locked_shifts_kept ?? 0} turni preservati`);
      } else {
        toast.success(`Turni mensili generati: ${totalShifts} turni`);
      }
    },
    onError: (err: any) => {
      const msg = err.message ?? "Errore generazione turni";
      if (msg.includes("GEMINI_AI_REQUIRED")) {
        const cleanMsg = msg.replace("GEMINI_AI_REQUIRED: ", "");
        toast.error(`Gemini 2.5 AI non disponibile: ${cleanMsg}`, { duration: 10000 });
      } else {
        toast.error(msg);
      }
    },
  });
}

export function usePublishMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { store_id: string; period_start: string; period_end: string }) => {
      const { data, error } = await supabase.functions.invoke("publish-shifts", {
        body: {
          store_id:     params.store_id,
          period_start: params.period_start,
          period_end:   params.period_end,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["generation-runs"] });
      qc.invalidateQueries({ queryKey: ["schedule-periods"] });
      toast.success(`${data?.published ?? 0} turni mensili pubblicati`);
    },
    onError: (err: any) => toast.error(err.message ?? "Errore pubblicazione turni"),
  });
}

// Backward compat alias
export function usePublishWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { store_id: string; week_start: string }) => {
      const { data, error } = await supabase.functions.invoke("publish-shifts", {
        body: { store_id: params.store_id, period_start: params.week_start },
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

// Rigenera dal giorno specificato fino a fine mese (dopo malattia improvvisa, ecc.)
export function usePatchMonthlySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      store_id: string;
      from_date: string;
      department?: "sala" | "cucina";
    }) => {
      const { data, error } = await supabase.functions.invoke("patch-monthly-schedule", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["generation-runs"] });
      qc.invalidateQueries({ queryKey: ["generation-run-suggestions"] });
      toast.success(
        `Rigenera completato da ${data?.from_date} — ${data?.total_shifts} turni rigenerati, ${data?.locked_shifts_preserved} turni precedenti preservati`
      );
    },
    onError: (err: any) => toast.error(err.message ?? "Errore rigenerazione parziale"),
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
