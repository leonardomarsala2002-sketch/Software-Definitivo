import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface NavItem {
  title: string;
  url: string;
  emoji: string;
  section?: "main" | "secondary";
  /** Roles that can see this item. undefined = all roles */
  roles?: AppRole[];
  /** Accent color for this section */
  accentColor: string;
}

export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", emoji: "📊", section: "main", accentColor: "blue" },
  { title: "Calendario Team", url: "/team-calendar", emoji: "📅", section: "main", accentColor: "green" },
  { title: "Richieste", url: "/requests", emoji: "🔄", section: "main", accentColor: "amber" },
  { title: "Dipendenti", url: "/employees", emoji: "👥", section: "main", roles: ["super_admin", "admin"], accentColor: "purple" },
  { title: "Impostazioni", url: "/store-settings", emoji: "⚙️", section: "secondary", roles: ["super_admin", "admin"], accentColor: "rose" },
];

export const bottomNavItems = navItems.filter((item) => item.section === "main");

export function filterNavByRole(items: NavItem[], role: AppRole | null): NavItem[] {
  if (!role) return [];
  return items.filter((item) => !item.roles || item.roles.includes(role));
}

export function getAccentColorForPath(path: string): string {
  const item = navItems.find(i => i.url === path) || navItems.find(i => path.startsWith(i.url) && i.url !== "/");
  return item?.accentColor || "blue";
}
