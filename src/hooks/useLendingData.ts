import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LendingRecord {
  id: string;
  user_id: string;
  source_store_id: string;
  target_store_id: string;
  department: string;
  suggested_date: string;
  suggested_start_time: string;
  suggested_end_time: string;
  reason: string | null;
  status: string;
  source_approved: boolean | null;
  target_approved: boolean | null;
  // Joined
  user_name?: string;
  source_store_name?: string;
  target_store_name?: string;
}

/**
 * Fetch all lending suggestions involving the current store (as source or target).
 * Returns accepted/pending lending records for a given month.
 */
export function useStoreLendings(storeId: string | undefined, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return useQuery({
    queryKey: ["store-lendings", storeId, year, month],
    queryFn: async (): Promise<LendingRecord[]> => {
      if (!storeId) return [];

      // Fetch lendings where this store is source OR target
      const { data, error } = await supabase
        .from("lending_suggestions")
        .select("*")
        .or(`source_store_id.eq.${storeId},target_store_id.eq.${storeId}`)
        .gte("suggested_date", startDate)
        .lte("suggested_date", endDate)
        .in("status", ["pending", "accepted"]);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch names for users and stores
      const userIds = [...new Set(data.map(d => d.user_id))];
      const storeIds = [...new Set([...data.map(d => d.source_store_id), ...data.map(d => d.target_store_id)])];

      const [profilesRes, storesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", userIds),
        supabase.from("stores").select("id, name").in("id", storeIds),
      ]);

      const nameMap = new Map((profilesRes.data ?? []).map(p => [p.id, p.full_name ?? "Dipendente"]));
      const storeMap = new Map((storesRes.data ?? []).map(s => [s.id, s.name]));

      return data.map(d => ({
        ...d,
        user_name: nameMap.get(d.user_id),
        source_store_name: storeMap.get(d.source_store_id),
        target_store_name: storeMap.get(d.target_store_id),
      })) as LendingRecord[];
    },
    enabled: !!storeId,
  });
}
