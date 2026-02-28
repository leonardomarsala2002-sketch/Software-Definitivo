import {
  LayoutDashboard,
  CalendarDays,
  Inbox,
  Users,
  Settings,
  FileText,
  MessageSquare,
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
  { title: "Calendario Team", url: "/team-calendar", icon: CalendarDays, section: "main", roles: ["admin", "employee"], tutorialId: "nav-team-calendar" },
  { title: "Orari Admin", url: "/admin-shifts", icon: CalendarDays, section: "main", roles: ["super_admin"], tutorialId: "nav-admin-shifts" },
  { title: "Richieste", url: "/requests", icon: Inbox, section: "main", roles: ["admin", "employee"], tutorialId: "nav-requests" },
  { title: "Messaggi", url: "/messages", icon: MessageSquare, section: "main", tutorialId: "nav-messages" },
  { title: "Dipendenti", url: "/employees", icon: Users, section: "main", roles: ["super_admin", "admin"], tutorialId: "nav-employees" },
  { title: "Impostazioni Store", url: "/store-settings", icon: Settings, section: "secondary", roles: ["super_admin", "admin"], tutorialId: "nav-store-settings" },
  { title: "Audit Log", url: "/audit-log", icon: FileText, section: "secondary", roles: ["super_admin"], tutorialId: "nav-audit-log" },
];

export const bottomNavItems = navItems.filter((item) => item.section === "main");

export function filterNavByRole(items: NavItem[], role: AppRole | null): NavItem[] {
  if (!role) return [];
  return items.filter((item) => !item.roles || item.roles.includes(role));
}
