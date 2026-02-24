import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface CorrectionAction {
  id: string;
  label: string;
  description: string;
  actionType: "shift_earlier" | "shift_later" | "add_split" | "extend_shift" | "lending" | "remove_surplus" | "reduce_hours" | "increase_splits" | "increase_days_off" | "generic";
  userId?: string;
  userName?: string;
  shiftId?: string;
  newStartTime?: string;
  newEndTime?: string;
  sourceStoreId?: string;
  sourceStoreName?: string;
  targetStoreId?: string;
  targetStoreName?: string;
  suggestedHours?: number;
}

export interface OptimizationSuggestion {
  id: string;
  type: "surplus" | "lending" | "overtime_balance" | "uncovered" | "hour_reduction";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  actionLabel: string;
  declineLabel: string;
  shiftId?: string;
  userId?: string;
  userName?: string;
  date?: string;
  suggestedHours?: number;
  sourceStoreId?: string;
  sourceStoreName?: string;
  targetStoreId?: string;
  targetStoreName?: string;
  slot?: string;
  /** Multiple corrective actions for this problem - user cycles through on decline */
  alternatives?: CorrectionAction[];
  /** How many people are surplus, and context */
  surplusCount?: number;
  surplusReason?: string;
}

/**
 * Reads optimization suggestions from generation_runs.suggestions (server-side computed).
 * No more client-side heavy computation.
 */
export function useOptimizationSuggestions(
  runIds: string[],
): { suggestions: OptimizationSuggestion[]; isLoading: boolean } {
  const { data: runs, isLoading } = useQuery({
    queryKey: ["generation-run-suggestions", ...runIds],
    queryFn: async () => {
      if (runIds.length === 0) return [];
      const { data, error } = await supabase
        .from("generation_runs")
        .select("id, suggestions")
        .in("id", runIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: runIds.length > 0,
  });

  const suggestions = useMemo(() => {
    if (!runs || runs.length === 0) return [];
    const all: OptimizationSuggestion[] = [];
    const seenIds = new Set<string>();
    for (const run of runs) {
      const raw = run.suggestions as unknown as OptimizationSuggestion[] | null;
      if (Array.isArray(raw)) {
        for (const s of raw) {
          if (!seenIds.has(s.id)) {
            seenIds.add(s.id);
            all.push(s);
          }
        }
      }
    }
    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    all.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));
    return all;
  }, [runs]);

  return { suggestions, isLoading };
}

export interface LendingSuggestionRow {
  id: string;
  generation_run_id: string;
  user_id: string;
  source_store_id: string;
  target_store_id: string;
  department: string;
  suggested_date: string;
  suggested_start_time: string;
  suggested_end_time: string;
  reason: string | null;
  status: string;
}

export function useLendingSuggestions(runIds: string[]) {
  return useQuery({
    queryKey: ["lending-suggestions", ...runIds],
    queryFn: async (): Promise<LendingSuggestionRow[]> => {
      if (runIds.length === 0) return [];
      const { data, error } = await supabase
        .from("lending_suggestions")
        .select("*")
        .in("generation_run_id", runIds)
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []) as LendingSuggestionRow[];
    },
    enabled: runIds.length > 0,
  });
}
