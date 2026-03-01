import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type StoreRules = Tables<"store_rules">;
export type OpeningHour = Tables<"store_opening_hours">;
export type CoverageReq = Tables<"store_coverage_requirements">;
export type ShiftTemplate = Tables<"store_shift_templates">;
export type AllowedTime = Tables<"store_shift_allowed_times">;

export const DAY_LABELS = [
  "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica",
];

export function generateSlots(opening: string, closing: string): string[] {
  const slots: string[] = [];
  const [oh, om] = opening.split(":").map(Number);
  const [ch, cm] = closing.split(":").map(Number);
  const startMin = oh * 60 + (om || 0);
  const endMin = ch * 60 + (cm || 0);
  for (let m = startMin; m < endMin; m += 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

export function useStoreRules(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-rules", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_rules")
        .select("*")
        .eq("store_id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data as StoreRules | null;
    },
    enabled: !!storeId,
  });
}

export function useOpeningHours(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-opening-hours", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_opening_hours")
        .select("*")
        .eq("store_id", storeId!)
        .order("day_of_week");
      if (error) throw error;
      return (data ?? []) as OpeningHour[];
    },
    enabled: !!storeId,
  });
}

export function useCoverageRequirements(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-coverage", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_coverage_requirements")
        .select("*")
        .eq("store_id", storeId!)
        .order("day_of_week")
        .order("hour_slot");
      if (error) throw error;
      return (data ?? []) as CoverageReq[];
    },
    enabled: !!storeId,
  });
}

export function useShiftTemplates(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-shift-templates", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_shift_templates")
        .select("*")
        .eq("store_id", storeId!)
        .order("department")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as ShiftTemplate[];
    },
    enabled: !!storeId,
  });
}

export function useAllowedTimes(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-allowed-times", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_shift_allowed_times")
        .select("*")
        .eq("store_id", storeId!)
        .order("department")
        .order("kind")
        .order("hour");
      if (error) throw error;
      return (data ?? []) as AllowedTime[];
    },
    enabled: !!storeId,
  });
}

export function useSaveAllowedTimes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      times,
    }: {
      storeId: string;
      times: { department: "sala" | "cucina"; kind: "entry" | "exit"; hour: number; is_active: boolean }[];
    }) => {
      const { error: delErr } = await supabase
        .from("store_shift_allowed_times")
        .delete()
        .eq("store_id", storeId);
      if (delErr) throw delErr;
      if (times.length > 0) {
        const inserts = times.map((t) => ({ ...t, store_id: storeId }));
        const { error: insErr } = await supabase
          .from("store_shift_allowed_times")
          .insert(inserts as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["store-allowed-times", vars.storeId] });
      toast.success("Entrate/Uscite aggiornate");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore salvataggio entrate/uscite"),
  });
}

export function useInitStoreConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (storeId: string) => {
      const { error: rulesErr } = await supabase
        .from("store_rules")
        .insert({ store_id: storeId } as any);
      if (rulesErr) throw rulesErr;

      const hours: TablesInsert<"store_opening_hours">[] = Array.from(
        { length: 7 },
        (_, i) => ({
          store_id: storeId,
          day_of_week: i,
          opening_time: "09:00",
          closing_time: "22:00",
        })
      );
      const { error: hoursErr } = await supabase
        .from("store_opening_hours")
        .insert(hours as any);
      if (hoursErr) throw hoursErr;
    },
    onSuccess: (_d, storeId) => {
      qc.invalidateQueries({ queryKey: ["store-rules", storeId] });
      qc.invalidateQueries({ queryKey: ["store-opening-hours", storeId] });
      toast.success("Configurazione iniziale creata");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore creazione configurazione"),
  });
}

export function useUpdateStoreRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ storeId, updates }: { storeId: string; updates: Partial<StoreRules> }) => {
      const { error } = await supabase
        .from("store_rules")
        .update(updates as any)
        .eq("store_id", storeId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["store-rules", vars.storeId] });
      toast.success("Regole aggiornate");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore salvataggio regole"),
  });
}

export function useUpdateOpeningHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ storeId, hours }: { storeId: string; hours: OpeningHour[] }) => {
      for (const h of hours) {
        const { error } = await supabase
          .from("store_opening_hours")
          .update({ opening_time: h.opening_time, closing_time: h.closing_time } as any)
          .eq("id", h.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["store-opening-hours", vars.storeId] });
      qc.invalidateQueries({ queryKey: ["store-coverage", vars.storeId] });
      toast.success("Orari aggiornati");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore salvataggio orari"),
  });
}

export function useSaveCoverage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      rows,
    }: {
      storeId: string;
      rows: { day_of_week: number; hour_slot: string; department: "sala" | "cucina"; min_staff_required: number; max_staff_required?: number | null }[];
    }) => {
      const { error: delErr } = await supabase
        .from("store_coverage_requirements")
        .delete()
        .eq("store_id", storeId);
      if (delErr) throw delErr;
      if (rows.length > 0) {
        const inserts = rows.map((r) => ({ ...r, store_id: storeId, max_staff_required: r.max_staff_required ?? null }));
        const { error: insErr } = await supabase
          .from("store_coverage_requirements")
          .insert(inserts as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["store-coverage", vars.storeId] });
      toast.success("Copertura aggiornata");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore salvataggio copertura"),
  });
}

export function useSaveShiftTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      templates,
    }: {
      storeId: string;
      templates: { department: "sala" | "cucina"; start_time: string; end_time: string; is_active: boolean }[];
    }) => {
      const { error: delErr } = await supabase
        .from("store_shift_templates")
        .delete()
        .eq("store_id", storeId);
      if (delErr) throw delErr;
      if (templates.length > 0) {
        const inserts = templates.map((t) => ({ ...t, store_id: storeId }));
        const { error: insErr } = await supabase
          .from("store_shift_templates")
          .insert(inserts as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["store-shift-templates", vars.storeId] });
      toast.success("Template turni aggiornati");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore salvataggio template"),
  });
}
