import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
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

/** Cycle order for preview role switching */
const ROLE_CYCLE: (AppRole | null)[] = ["super_admin", "admin", "employee", null];

/** Returns true when running inside Lovable preview (not published) */
function isPreviewEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes("-preview--") || host === "localhost";
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** The effective role (may be overridden by preview switch) */
  role: AppRole | null;
  /** The real role from the database */
  realRole: AppRole | null;
  /** Whether we're currently in preview-role mode */
  isViewingAsEmployee: boolean;
  /** Toggle preview role (kept for backward compat, but now cycles) */
  toggleViewAsEmployee: () => void;
  /** Cycle to next preview role (super_admin → admin → employee → off) */
  cyclePreviewRole: () => void;
  /** The currently forced preview role, or null if using real role */
  previewRole: AppRole | null;
  /** Whether preview switching is available */
  isPreviewMode: boolean;
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
  const [realRole, setRealRole] = useState<AppRole | null>(null);
  const [previewRole, setPreviewRole] = useState<AppRole | null>(null);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [activeStore, setActiveStore] = useState<StoreInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isPreviewMode = useMemo(() => isPreviewEnvironment(), []);

  // Effective role: use previewRole if set, otherwise realRole
  const role: AppRole | null = previewRole ?? realRole;

  // Backward compat: "isViewingAsEmployee" is true when previewing a non-real role
  const isViewingAsEmployee = previewRole !== null && previewRole !== realRole;

  /** Cycle through preview roles: super_admin → admin → employee → off (real) */
  const cyclePreviewRole = useCallback(() => {
    if (!isPreviewMode) return;
    setPreviewRole(prev => {
      const currentIdx = ROLE_CYCLE.indexOf(prev);
      const nextIdx = (currentIdx + 1) % ROLE_CYCLE.length;
      return ROLE_CYCLE[nextIdx];
    });
  }, [isPreviewMode]);

  // Legacy toggle (maps to cycle)
  const toggleViewAsEmployee = cyclePreviewRole;

  const loadUserData = useCallback(async (userId: string) => {
    try {
      const { data: roleData } = await supabase.rpc("get_user_role", {
        _user_id: userId,
      });

      setRealRole(roleData as AppRole | null);

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
      setRealRole(null);
      setStores([]);
      setActiveStore(null);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setIsLoading(true);
          setTimeout(() => {
            loadUserData(newSession.user.id).finally(() => setIsLoading(false));
          }, 0);
        } else {
          setRealRole(null);
          setStores([]);
          setActiveStore(null);
          setPreviewRole(null);
          setIsLoading(false);
        }
      }
    );

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
    setRealRole(null);
    setStores([]);
    setActiveStore(null);
    setPreviewRole(null);
  }, []);

  const isAuthorized = realRole !== null && stores.length > 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        realRole,
        isViewingAsEmployee,
        toggleViewAsEmployee,
        cyclePreviewRole,
        previewRole,
        isPreviewMode,
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
