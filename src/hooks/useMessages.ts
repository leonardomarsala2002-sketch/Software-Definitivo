import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  // joined
  other_user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ContactOption {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  department: string | null;
}

export function useConversations() {
  const { user } = useAuth();

  return useQuery<Conversation[]>({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      // Get all conversation IDs for current user
      const { data: participations, error: pErr } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user!.id);
      if (pErr) throw pErr;
      if (!participations?.length) return [];

      const convIds = participations.map((p: any) => p.conversation_id);

      // Get conversations
      const { data: conversations, error: cErr } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convIds)
        .order("updated_at", { ascending: false });
      if (cErr) throw cErr;

      // Get other participants
      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id, profiles:profiles!conversation_participants_user_id_fkey(id, full_name, email, avatar_url)")
        .in("conversation_id", convIds)
        .neq("user_id", user!.id);

      // Get last messages
      const results: Conversation[] = [];
      for (const conv of conversations ?? []) {
        const otherP = (allParticipants ?? []).find((p: any) => p.conversation_id === conv.id);

        // Get last message
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, created_at, sender_id")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Count unread
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("is_read", false)
          .neq("sender_id", user!.id);

        results.push({
          ...conv,
          other_user: otherP ? (otherP as any).profiles : undefined,
          last_message: lastMsg ?? null,
          unread_count: count ?? 0,
        });
      }

      return results;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // poll every 10s
  });
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();

  return useQuery<Message[]>({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
    enabled: !!conversationId && !!user?.id,
    refetchInterval: 5000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user!.id,
          content: content.trim(),
        })
        .select()
        .single();
      if (error) throw error;

      // Get other participant for notification
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user!.id);

      const senderName = user?.user_metadata?.full_name || user?.email || "Qualcuno";
      for (const p of participants ?? []) {
        await supabase.from("notifications").insert({
          user_id: p.user_id,
          title: "Nuovo messaggio",
          message: `${senderName}: ${content.trim().slice(0, 80)}${content.trim().length > 80 ? "..." : ""}`,
          type: "new_message",
          link: "/messages",
        });
      }

      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .eq("is_read", false)
        .neq("sender_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      // Check if conversation already exists between these two users
      const { data: myConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user!.id);

      if (myConvs?.length) {
        const { data: existing } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", otherUserId)
          .in("conversation_id", myConvs.map((c: any) => c.conversation_id));

        if (existing?.length) {
          return existing[0].conversation_id;
        }
      }

      // Create new conversation
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .insert({})
        .select()
        .single();
      if (convErr) throw convErr;

      // Add both participants
      const { error: pErr } = await supabase
        .from("conversation_participants")
        .insert([
          { conversation_id: conv.id, user_id: user!.id },
          { conversation_id: conv.id, user_id: otherUserId },
        ]);
      if (pErr) throw pErr;

      return conv.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useContacts() {
  const { user, role } = useAuth();

  return useQuery<ContactOption[]>({
    queryKey: ["messaging-contacts", user?.id, role],
    queryFn: async () => {
      // Use can_message RPC via direct query approach
      // We fetch all potential contacts and filter client-side using the role rules
      // For efficiency, we fetch based on role knowledge

      let contactUserIds: string[] = [];

      if (role === "super_admin") {
        // Can message other super_admins + all admins
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["super_admin", "admin"]);
        contactUserIds = (roles ?? []).filter((r: any) => r.user_id !== user!.id).map((r: any) => r.user_id);
      } else if (role === "admin") {
        // Can message: super_admins, all admins, own store employees
        const { data: adminAndSa } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["super_admin", "admin"]);
        const adminIds = (adminAndSa ?? []).filter((r: any) => r.user_id !== user!.id).map((r: any) => r.user_id);

        // Own store employees
        const { data: myStores } = await supabase
          .from("user_store_assignments")
          .select("store_id")
          .eq("user_id", user!.id);
        const storeIds = (myStores ?? []).map((s: any) => s.store_id);

        let employeeIds: string[] = [];
        if (storeIds.length) {
          const { data: storeMembers } = await supabase
            .from("user_store_assignments")
            .select("user_id")
            .in("store_id", storeIds)
            .neq("user_id", user!.id);

          const { data: empRoles } = await supabase
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", (storeMembers ?? []).map((m: any) => m.user_id))
            .eq("role", "employee");

          employeeIds = (empRoles ?? []).map((r: any) => r.user_id);
        }

        contactUserIds = [...new Set([...adminIds, ...employeeIds])];
      } else if (role === "employee") {
        // Can only message admins of own store
        const { data: myStores } = await supabase
          .from("user_store_assignments")
          .select("store_id")
          .eq("user_id", user!.id);
        const storeIds = (myStores ?? []).map((s: any) => s.store_id);

        if (storeIds.length) {
          const { data: storeMembers } = await supabase
            .from("user_store_assignments")
            .select("user_id")
            .in("store_id", storeIds)
            .neq("user_id", user!.id);

          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", (storeMembers ?? []).map((m: any) => m.user_id))
            .eq("role", "admin");

          contactUserIds = (adminRoles ?? []).map((r: any) => r.user_id);
        }
      }

      if (!contactUserIds.length) return [];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", contactUserIds);

      // Fetch roles for display
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", contactUserIds);

      // Fetch departments
      const { data: details } = await supabase
        .from("employee_details")
        .select("user_id, department")
        .in("user_id", contactUserIds);

      const rolesMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
      const deptMap = new Map((details ?? []).map((d: any) => [d.user_id, d.department]));

      return (profiles ?? []).map((p: any) => ({
        ...p,
        role: rolesMap.get(p.id) ?? null,
        department: deptMap.get(p.id) ?? null,
      }));
    },
    enabled: !!user?.id && !!role,
  });
}
