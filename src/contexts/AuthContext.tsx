import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface StoreInfo {
  id: string;
  name: string;
  address: string | null;
  is_primary: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  stores: StoreInfo[];
  activeStore: StoreInfo | null;
  setActiveStore: (store: StoreInfo) => void;
  isLoading: boolean;
  isAuthorized: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [activeStore, setActiveStore] = useState<StoreInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = useCallback(async (userId: string) => {
    try {
      // Load role via RPC
      const { data: roleData } = await supabase.rpc("get_user_role", {
        _user_id: userId,
      });

      setRole(roleData as AppRole | null);

      // Load stores via join
      const { data: assignments } = await supabase
        .from("user_store_assignments")
        .select("store_id, is_primary, stores(id, name, address)")
        .eq("user_id", userId);

      if (assignments && assignments.length > 0) {
        const storeList: StoreInfo[] = assignments.map((a: any) => ({
          id: a.stores.id,
          name: a.stores.name,
          address: a.stores.address,
          is_primary: a.is_primary,
        }));
        setStores(storeList);

        // Set active store: primary first, or first available
        const primary = storeList.find((s) => s.is_primary) || storeList[0];
        setActiveStore(primary);
      } else {
        setStores([]);
        setActiveStore(null);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      setRole(null);
      setStores([]);
      setActiveStore(null);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Defer data loading to avoid deadlocks
          setTimeout(() => loadUserData(newSession.user.id), 0);
        } else {
          setRole(null);
          setStores([]);
          setActiveStore(null);
          setIsLoading(false);
        }
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        loadUserData(existingSession.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRole(null);
    setStores([]);
    setActiveStore(null);
  }, []);

  const isAuthorized = role !== null && stores.length > 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        stores,
        activeStore,
        setActiveStore,
        isLoading,
        isAuthorized,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
