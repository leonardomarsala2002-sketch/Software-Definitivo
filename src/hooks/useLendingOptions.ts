import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabaseClient"; // <-- Import corretto

export function useLendingOptions(storeId: string, mode: "surplus" | "buchi") {
  return useQuery({
    queryKey: ["lending-options", storeId, mode],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-lending-options", {
        body: { store_id: storeId, mode },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });
}
