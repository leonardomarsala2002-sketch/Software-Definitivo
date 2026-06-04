import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { navItems, filterNavByRole } from "@/config/navigation";
import { LayoutDashboard, CalendarDays, Inbox, Users, MoreHorizontal, UserCircle, LayoutGrid } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const BOTTOM_PRIORITY: Record<AppRole, string[]> = {
  super_admin: ["/", "/team-calendar", "/employees", "/requests"],
  admin:        ["/", "/team-calendar", "/employees", "/requests"],
  store_manager:["/", "/team-calendar", "/employees", "/requests"],
  employee:     ["/", "/personal-calendar", "/requests", "/profile"],
};

export function BottomNav() {
  const { role } = useAuth();
  const location = useLocation();

  if (!role) return null;

  const allFiltered = filterNavByRole(navItems, role);
  const priority = BOTTOM_PRIORITY[role] ?? ["/", "/requests"];
  const bottomItems = priority
    .map((url) => allFiltered.find((i) => i.url === url))
    .filter(Boolean) as typeof navItems;

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-border safe-area-bottom">
      <div className="flex items-stretch h-16">
        {bottomItems.map((item) => {
          const active = isActive(item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-lg transition-colors",
                active && "bg-accent"
              )}>
                <item.icon className="h-4 w-4" />
              </span>
              <span className="leading-none">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
