import {
  LayoutDashboard,
  CalendarDays,
  LayoutGrid,
  Inbox,
  Users,
  Settings,
  FileText,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: "main" | "secondary";
  /** Roles that can see this item. undefined = all roles */
  roles?: AppRole[];
  /** Tutorial selector id */
  tutorialId?: string;
}

export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, section: "main", tutorialId: "nav-dashboard" },
  { title: "Scheduler", url: "/scheduler", icon: LayoutGrid, section: "main", roles: ["admin", "store_manager", "super_admin"] },
  { title: "Calendario Team", url: "/team-calendar", icon: CalendarDays, section: "main", roles: ["admin", "store_manager", "employee"], tutorialId: "nav-team-calendar" },
  { title: "Orari Admin", url: "/admin-shifts", icon: CalendarDays, section: "main", roles: ["super_admin"], tutorialId: "nav-admin-shifts" },
  { title: "Richieste", url: "/requests", icon: Inbox, section: "main", roles: ["admin", "store_manager", "employee"], tutorialId: "nav-requests" },
  { title: "Messaggi", url: "/messages", icon: MessageSquare, section: "main", tutorialId: "nav-messages" },
  { title: "Dipendenti", url: "/employees", icon: Users, section: "main", roles: ["super_admin", "admin", "store_manager"], tutorialId: "nav-employees" },
  { title: "AI Assistant", url: "/ai-assistant", icon: Sparkles, section: "secondary", roles: ["admin", "store_manager"] },
  { title: "Impostazioni", url: "/settings", icon: Settings, section: "secondary", roles: ["super_admin", "admin", "store_manager"] },
  { title: "Impostazioni Store", url: "/store-settings", icon: Settings, section: "secondary", roles: ["super_admin", "admin", "store_manager"], tutorialId: "nav-store-settings" },
  { title: "Audit Log", url: "/audit-log", icon: FileText, section: "secondary", roles: ["super_admin", "admin", "store_manager"], tutorialId: "nav-audit-log" },
];

export const bottomNavItems = navItems.filter((item) => item.section === "main");

export function filterNavByRole(items: NavItem[], role: AppRole | null): NavItem[] {
  if (!role) return [];
  return items.filter((item) => !item.roles || item.roles.includes(role));
}
