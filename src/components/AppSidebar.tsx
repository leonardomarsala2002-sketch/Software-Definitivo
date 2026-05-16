import { navItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Sun, Moon, LogOut } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  store_manager: "Store Manager",
  employee: "Dipendente",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-gradient-to-r from-[#635bff] to-[#4f46e5] text-white",
  admin: "bg-gradient-to-r from-[#10b981] to-[#059669] text-white",
  store_manager: "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white",
  employee: "bg-[#f3f4f8] text-[#6b7280]",
};

export function AppSidebar() {
  const { theme, toggleTheme } = useTheme();
  const {
    role, realRole, user, activeStore, signOut,
    cyclePreviewRole, previewRole, isPreviewMode,
  } = useAuth();
  const location = useLocation();
  const filtered = filterNavByRole(navItems, role);
  const mainItems = filtered.filter((i) => i.section === "main");
  const secondaryItems = filtered.filter((i) => i.section === "secondary");

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  const displayName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Utente";

  return (
    <aside className="hidden md:flex w-[220px] flex-col h-full bg-white border-r border-[#e4e7ec] shadow-[1px_0_0_0_#e4e7ec] shrink-0">
      <div className="flex flex-col h-full py-5 px-3">

        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#635bff] to-[#00d4aa]">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <span className="text-[15px] font-bold text-[#0f1117] leading-none block">Shift</span>
            <span className="text-[11px] font-medium text-[#6b7280] leading-none">Scheduler</span>
          </div>
        </div>

        {/* Store name */}
        {activeStore && (
          <div className="mx-2 mb-4 px-3 py-2 rounded-lg bg-[#f8f9fc] border border-[#e4e7ec]">
            <p className="text-[10px] font-medium text-[#6b7280] uppercase tracking-wide">Store attivo</p>
            <p className="text-[13px] font-semibold text-[#0f1117] truncate mt-0.5">{activeStore.name}</p>
          </div>
        )}

        {/* Preview role switch */}
        {isPreviewMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={cyclePreviewRole}
                className={cn(
                  "mb-3 mx-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200",
                  previewRole
                    ? "text-[#635bff] ring-1 ring-[#635bff]/40 bg-[#f5f3ff]"
                    : "text-[#6b7280] hover:text-[#0f1117] hover:bg-[#f3f4f8]"
                )}
              >
                <Eye className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {previewRole ? `Preview: ${previewRole === "super_admin" ? "SA" : previewRole === "admin" ? "Admin" : previewRole === "store_manager" ? "SM" : "Emp"}` : "Preview ruolo"}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Clicca per cambiare ruolo di preview</TooltipContent>
          </Tooltip>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 flex flex-col overflow-y-auto space-y-0.5">
          {mainItems.map((item) => {
            const active = isActive(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                aria-label={item.title}
                data-tutorial={item.tutorialId}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                  "relative",
                  active
                    ? "bg-gradient-to-r from-[#f5f3ff] to-[#ede9fe] text-[#635bff] font-semibold"
                    : "text-[#6b7280] hover:text-[#0f1117] hover:bg-[#f3f4f8]",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[#635bff]" />
                )}
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-[#635bff]" : "text-[#9ca3af] group-hover:text-[#0f1117]",
                  )}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}

          {secondaryItems.length > 0 && (
            <>
              <div className="my-2 mx-2 h-px bg-[#e4e7ec]" />
              {secondaryItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <Link
                    key={item.url}
                    to={item.url}
                    aria-label={item.title}
                    data-tutorial={item.tutorialId}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 relative",
                      active
                        ? "bg-gradient-to-r from-[#f5f3ff] to-[#ede9fe] text-[#635bff] font-semibold"
                        : "text-[#6b7280] hover:text-[#0f1117] hover:bg-[#f3f4f8]",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[#635bff]" />
                    )}
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-[#635bff]" : "text-[#9ca3af] group-hover:text-[#0f1117]")} />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Bottom section */}
        <div className="mt-4 pt-4 border-t border-[#e4e7ec] space-y-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#6b7280] hover:text-[#0f1117] hover:bg-[#f3f4f8] transition-all duration-200"
            aria-label="Cambia tema"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span>{theme === "dark" ? "Tema chiaro" : "Tema scuro"}</span>
          </button>

          {/* User card */}
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#635bff] to-[#4f46e5]">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0f1117] truncate leading-tight">{displayName}</p>
              <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold mt-0.5", ROLE_COLORS[role ?? "employee"])}>
                {ROLE_LABELS[role ?? "employee"] ?? role}
              </span>
            </div>
            <button onClick={signOut} className="shrink-0 text-[#9ca3af] hover:text-[#ef4444] transition-colors p-1 rounded-lg hover:bg-[#fee2e2]" title="Esci">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
