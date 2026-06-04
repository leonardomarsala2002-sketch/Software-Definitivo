import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function RoleRoute({ children, roles }: { children: React.ReactNode; roles: AppRole[] }) {
  const { role, isLoading } = useAuth();
  if (isLoading) return null;
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
