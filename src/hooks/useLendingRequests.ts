import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabaseClient"; // <-- Import corretto

export function useLendingRequests(storeId: string) {
  return useQuery({
    queryKey: ["lending-requests", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lending_requests")
        .select("*, lending_request_messages(*)")
        .or(`proposer_store_id.eq.${storeId},receiver_store_id.eq.${storeId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });
}
