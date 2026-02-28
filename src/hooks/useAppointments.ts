import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Appointment {
  id: string;
  title: string;
  description: string | null;
  category: string;
  notes: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  store_id: string;
  created_by: string;
  target_user_id: string | null;
  status: string;
  decline_reason: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  target_profile?: { full_name: string | null; email: string | null } | null;
  creator_profile?: { full_name: string | null; email: string | null } | null;
  store?: { name: string } | null;
}

export function useAppointments(month: number, year: number) {
  const { user, activeStore, role } = useAuth();
  const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0);
  const lastDayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  return useQuery({
    queryKey: ["appointments", user?.id, activeStore?.id, month, year, role],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("*, target_profile:profiles!appointments_target_user_id_fkey(full_name, email), creator_profile:profiles!appointments_created_by_fkey(full_name, email), store:stores!appointments_store_id_fkey(name)")
        .gte("appointment_date", firstDay)
        .lte("appointment_date", lastDayStr)
        .order("appointment_date")
        .order("start_time");

      if (role !== "super_admin" && activeStore?.id) {
        query = query.eq("store_id", activeStore.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      category: string;
      notes?: string;
      appointment_date: string;
      start_time: string;
      end_time: string;
      store_id: string;
      target_user_id?: string;
    }) => {
      const { data, error } = await supabase
        .from("appointments")
        .insert({ ...input, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Send notification to target user
      if (input.target_user_id) {
        await supabase.from("notifications").insert({
          user_id: input.target_user_id,
          title: "Nuovo appuntamento",
          message: `Hai un nuovo appuntamento: "${input.title}" il ${input.appointment_date}`,
          type: "appointment_request",
          store_id: input.store_id,
          link: "/",
        });
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useRespondAppointment() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, status, created_by, decline_reason }: { id: string; status: "accepted" | "declined"; created_by: string; decline_reason?: string }) => {
      const updatePayload: Record<string, unknown> = { status, responded_at: new Date().toISOString() };
      if (status === "declined" && decline_reason) {
        updatePayload.decline_reason = decline_reason;
      }
      const { error } = await supabase
        .from("appointments")
        .update(updatePayload)
        .eq("id", id);
      if (error) throw error;

      const userName = user?.user_metadata?.full_name || user?.email || "Un utente";
      const message = status === "accepted"
        ? `${userName} ha accettato l'appuntamento`
        : `${userName} ha rifiutato l'appuntamento${decline_reason ? `: "${decline_reason}"` : ""}`;
      await supabase.from("notifications").insert({
        user_id: created_by,
        title: status === "accepted" ? "Appuntamento accettato" : "Appuntamento rifiutato",
        message,
        type: "appointment_response",
        link: "/",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, target_user_id }: { id: string; target_user_id: string | null }) => {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);
      if (error) throw error;

      // Notify the target user if one exists
      if (target_user_id) {
        const userName = user?.user_metadata?.full_name || user?.email || "Un utente";
        await supabase.from("notifications").insert({
          user_id: target_user_id,
          title: "Appuntamento annullato",
          message: `${userName} ha annullato un appuntamento`,
          type: "appointment_cancelled",
          link: "/",
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}
