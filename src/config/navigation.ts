import {
  LayoutDashboard,
  CalendarDays,
  Calendar,
  Inbox,
  Users,
  Settings,
  FileText,
  Info,
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
}

export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, section: "main" },
  { title: "Calendario Team", url: "/team-calendar", icon: CalendarDays, section: "main" },
  { title: "Calendario Personale", url: "/personal-calendar", icon: Calendar, section: "main" },
  { title: "Richieste", url: "/requests", icon: Inbox, section: "main" },
  { title: "Dipendenti", url: "/employees", icon: Users, section: "main", roles: ["super_admin", "admin"] },
  { title: "Impostazioni Store", url: "/store-settings", icon: Settings, section: "secondary", roles: ["super_admin", "admin"] },
  { title: "Audit Log", url: "/audit-log", icon: FileText, section: "secondary", roles: ["super_admin"] },
  { title: "Info", url: "/info", icon: Info, section: "secondary" },
];

export const bottomNavItems = navItems.filter((item) => item.section === "main");

export function filterNavByRole(items: NavItem[], role: AppRole | null): NavItem[] {
  if (!role) return [];
  return items.filter((item) => !item.roles || item.roles.includes(role));
}
