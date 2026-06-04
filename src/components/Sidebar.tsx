import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { navItems, filterNavByRole } from "@/config/navigation";
import { Zap, LogOut } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  store_manager: "Manager",
  employee: "Dipendente",
};

export function Sidebar() {
  const { user, role, activeStore, signOut } = useAuth();
  const location = useLocation();

  const filtered = filterNavByRole(navItems, role);
  const mainItems = filtered.filter((i) => i.section === "main");
  const secondaryItems = filtered.filter((i) => i.section === "secondary");

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Utente";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const NavLink = ({ item }: { item: (typeof navItems)[0] }) => {
    const active = isActive(item.url);
    return (
      <Link
        to={item.url}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
          active
            ? "bg-accent text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        <span className="flex-1 truncate">{item.title}</span>
        {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Zap className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-[14px] font-bold tracking-tight text-foreground">
          Shift Scheduler
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-5">
        <div className="space-y-0.5">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Menu
          </p>
          {mainItems.map((item) => (
            <NavLink key={item.url} item={item} />
          ))}
        </div>

        {secondaryItems.length > 0 && (
          <div className="space-y-0.5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Avanzate
            </p>
            {secondaryItems.map((item) => (
              <NavLink key={item.url} item={item} />
            ))}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-sidebar-border p-3 space-y-2">
        {activeStore && (
          <div className="flex items-center gap-2 rounded-md bg-accent px-2.5 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[11px] font-medium text-primary truncate">
              {activeStore.name}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary text-[10px] font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-foreground">
              {displayName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {ROLE_LABEL[role ?? ""] ?? role}
            </p>
          </div>
          <button
            onClick={signOut}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Esci"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
