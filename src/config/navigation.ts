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

export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: "main" | "secondary";
}

export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, section: "main" },
  { title: "Calendario Team", url: "/team-calendar", icon: CalendarDays, section: "main" },
  { title: "Calendario Personale", url: "/personal-calendar", icon: Calendar, section: "main" },
  { title: "Richieste", url: "/requests", icon: Inbox, section: "main" },
  { title: "Dipendenti", url: "/employees", icon: Users, section: "main" },
  { title: "Impostazioni Store", url: "/store-settings", icon: Settings, section: "secondary" },
  { title: "Audit Log", url: "/audit-log", icon: FileText, section: "secondary" },
  { title: "Info", url: "/info", icon: Info, section: "secondary" },
];

export const bottomNavItems = navItems.filter((item) => item.section === "main");
