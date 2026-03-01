import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EngineRule {
  id: string;
  label: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export function useEngineRules() {
  return useQuery({
    queryKey: ["engine-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engine_rules")
        .select("id, label, description, sort_order, is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as EngineRule[];
    },
  });
}

export function useUpsertEngineRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: { id?: string; label: string; description: string; sort_order: number }) => {
      if (rule.id) {
        const { error } = await supabase
          .from("engine_rules")
          .update({ label: rule.label, description: rule.description, sort_order: rule.sort_order })
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("engine_rules")
          .insert({ label: rule.label, description: rule.description, sort_order: rule.sort_order });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engine-rules"] });
      toast.success("Regola salvata");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteEngineRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("engine_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engine-rules"] });
      toast.success("Regola eliminata");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
