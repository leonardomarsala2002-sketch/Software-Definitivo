import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TimeOffRequest {
  id: string;
  user_id: string;
  store_id: string;
  request_type: string;
  request_date: string;
  selected_hour: number | null;
  department: string;
  notes: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useStoreRequests(storeId: string | undefined) {
  return useQuery({
    queryKey: ["time-off-requests", storeId],
    queryFn: async (): Promise<TimeOffRequest[]> => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeOffRequest[];
    },
    enabled: !!storeId,
  });
}

export function useMyRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-requests", userId],
    queryFn: async (): Promise<TimeOffRequest[]> => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeOffRequest[];
    },
    enabled: !!userId,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: {
      user_id: string;
      store_id: string;
      request_type: string;
      request_date: string;
      selected_hour: number | null;
      department: string;
      notes: string | null;
      autoApprove?: boolean;
    }) => {
      const { autoApprove, ...insertData } = req;
      const payload = autoApprove
        ? { ...insertData, status: "approved", reviewed_by: req.user_id, reviewed_at: new Date().toISOString() }
        : insertData;
      const { data, error } = await supabase.from("time_off_requests").insert(payload as any).select().single();
      if (error) throw error;

      // If auto-approved, create the exception immediately
      if (autoApprove && data) {
        const r = data as TimeOffRequest;
        if (["morning_off", "evening_off", "full_day_off", "ferie", "permesso", "malattia"].includes(r.request_type)) {
          const excType = r.request_type === "morning_off" || r.request_type === "evening_off"
            ? "modifica_orario"
            : r.request_type === "full_day_off"
              ? "permesso"
              : r.request_type as any;

          await supabase.from("employee_exceptions").insert({
            user_id: r.user_id,
            store_id: r.store_id,
            exception_type: excType,
            start_date: r.request_date,
            end_date: r.request_date,
            notes: `Auto-approvata: ${r.request_type}${r.selected_hour != null ? ` h${r.selected_hour}` : ""}${r.notes ? " - " + r.notes : ""}`,
            created_by: r.user_id,
          } as any);
        }
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["time-off-requests"] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      if (variables.autoApprove) {
        qc.invalidateQueries({ queryKey: ["employee-exceptions"] });
        toast.success("Richiesta creata e auto-approvata");
      } else {
        toast.success("Richiesta inviata");
      }
    },
    onError: (err: any) => toast.error(err.message ?? "Errore invio richiesta"),
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_off_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-off-requests"] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      toast.success("Richiesta eliminata");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore eliminazione"),
  });
}

export function useReviewRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      reviewedBy,
    }: {
      id: string;
      status: "approved" | "rejected";
      reviewedBy: string;
    }) => {
      const { error } = await supabase
        .from("time_off_requests")
        .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;

      // If approved and is morning/evening off, create employee_exception
      if (status === "approved") {
        const { data: req } = await supabase
          .from("time_off_requests")
          .select("*")
          .eq("id", id)
          .single();
        if (req) {
          const r = req as TimeOffRequest;
          if (["morning_off", "evening_off", "full_day_off", "ferie", "permesso", "malattia"].includes(r.request_type)) {
            const excType = r.request_type === "morning_off" || r.request_type === "evening_off"
              ? "modifica_orario"
              : r.request_type === "full_day_off"
                ? "permesso"
                : r.request_type as any;

            await supabase.from("employee_exceptions").insert({
              user_id: r.user_id,
              store_id: r.store_id,
              exception_type: excType,
              start_date: r.request_date,
              end_date: r.request_date,
              notes: `Auto: ${r.request_type}${r.selected_hour != null ? ` h${r.selected_hour}` : ""}${r.notes ? " - " + r.notes : ""}`,
              created_by: reviewedBy,
            } as any);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-off-requests"] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["employee-exceptions"] });
      toast.success("Richiesta aggiornata");
    },
    onError: (err: any) => toast.error(err.message ?? "Errore revisione"),
  });
}
