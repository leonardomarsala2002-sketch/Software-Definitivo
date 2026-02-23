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
  refreshUserData: (userId: string) => Promise<void>;
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

      // Super admin sees ALL stores; others see only assigned stores
      if (roleData === "super_admin") {
        const { data: allStores } = await supabase
          .from("stores")
          .select("id, name, address")
          .eq("is_active", true)
          .order("name");

        if (allStores && allStores.length > 0) {
          const storeList: StoreInfo[] = allStores.map((s, i) => ({
            id: s.id,
            name: s.name,
            address: s.address,
            is_primary: i === 0,
          }));
          setStores(storeList);
          setActiveStore(storeList[0]);
        } else {
          setStores([]);
          setActiveStore(null);
        }
      } else {
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
          const primary = storeList.find((s) => s.is_primary) || storeList[0];
          setActiveStore(primary);
        } else {
          setStores([]);
          setActiveStore(null);
        }
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
          // Show loading spinner while we fetch role & stores
          setIsLoading(true);
          // Defer data loading to avoid deadlocks
          setTimeout(() => {
            loadUserData(newSession.user.id).finally(() => setIsLoading(false));
          }, 0);
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
        refreshUserData: loadUserData,
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
