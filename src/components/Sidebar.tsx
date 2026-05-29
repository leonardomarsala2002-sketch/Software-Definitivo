import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { navItems, filterNavByRole } from "@/config/navigation";
import { Zap, X, ChevronRight, LogOut } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  store_manager: "Manager",
  employee: "Dipendente",
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
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
        onClick={onClose}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150",
          active
            ? "bg-indigo-50 text-indigo-700"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
            active
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500"
          )}
        >
          <item.icon className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1">{item.title}</span>
        {active && <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />}
      </Link>
    );
  };

  return (
    <>
      {/* Backdrop mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-slate-200/80 shadow-xl transition-transform duration-300 ease-in-out",
          "lg:static lg:z-auto lg:shadow-none lg:translate-x-0 lg:transition-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-slate-900">
            Shift Scheduler
          </span>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-6">
          {/* Main items */}
          <div className="space-y-0.5">
            <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-widest text-slate-400">
              Menu
            </p>
            {mainItems.map((item) => (
              <NavLink key={item.url} item={item} />
            ))}
          </div>

          {/* Secondary items */}
          {secondaryItems.length > 0 && (
            <div className="space-y-0.5">
              <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-widest text-slate-400">
                Avanzate
              </p>
              {secondaryItems.map((item) => (
                <NavLink key={item.url} item={item} />
              ))}
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-slate-100 p-4 space-y-3">
          {activeStore && (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              <span className="text-xs font-medium text-indigo-700 truncate">
                {activeStore.name}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-indigo-600 text-[10px] font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-800">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-400">
                {ROLE_LABEL[role ?? ""] ?? role}
              </p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title="Esci"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
