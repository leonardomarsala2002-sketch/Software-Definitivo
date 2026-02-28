import { navItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Store, LogOut, Eye, Settings, Sun, Moon } from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SA",
  admin: "A",
  employee: "E",
};

export function AppSidebar() {
  const { theme, toggleTheme } = useTheme();
  const {
    role, realRole, stores, activeStore, setActiveStore, signOut,
    cyclePreviewRole, previewRole, isPreviewMode,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const filtered = filterNavByRole(navItems, role);
  const mainItems = filtered.filter((i) => i.section === "main");
  const secondaryItems = filtered.filter((i) => i.section === "secondary");

  const canManageStores = realRole === "super_admin" || realRole === "admin";

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const iconClass = (active: boolean) =>
    `rounded-xl flex h-10 w-10 items-center justify-center transition-all duration-200 ${
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:text-foreground hover:bg-accent"
    }`;

  return (
    <aside className="hidden md:flex w-[72px] flex-col h-full border-r border-border bg-card/50">
      <div className="flex flex-col h-full items-center py-5">
        {/* Logo */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 mb-8">
          <span className="text-primary font-bold text-sm">S</span>
        </div>

        {/* Preview role switch */}
        {isPreviewMode && (
          <div className="mb-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={cyclePreviewRole}
                  className={`rounded-xl flex h-9 w-9 items-center justify-center relative transition-colors ${
                    previewRole
                      ? "text-primary ring-1 ring-primary/40 bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  {previewRole && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground leading-none">
                      {ROLE_LABELS[previewRole]}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium text-xs">
                {previewRole
                  ? `Preview: ${previewRole === "super_admin" ? "Super Admin" : previewRole === "admin" ? "Admin" : "Dipendente"} — clicca per cambiare`
                  : "Attiva preview ruolo"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 flex flex-col items-center py-2 space-y-1.5 overflow-y-auto">
          {mainItems.map((item) => {
            const active = isActive(item.url);
            return (
              <Tooltip key={item.url}>
                <TooltipTrigger asChild>
                  <Link to={item.url} aria-label={item.title} className="flex items-center justify-center">
                    <div className={iconClass(active)}>
                      <item.icon className="h-[18px] w-[18px]" />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium text-xs">{item.title}</TooltipContent>
              </Tooltip>
            );
          })}

          {secondaryItems.length > 0 && (
            <>
              <Separator className="mx-2 my-2 w-8 opacity-20" />
              {secondaryItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <Tooltip key={item.url}>
                    <TooltipTrigger asChild>
                      <Link to={item.url} aria-label={item.title} className="flex items-center justify-center">
                        <div className={iconClass(active)}>
                          <item.icon className="h-[18px] w-[18px]" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium text-xs">{item.title}</TooltipContent>
                  </Tooltip>
                );
              })}
            </>
          )}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto flex flex-col items-center pb-3 space-y-1.5">
          {role !== "employee" && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className={iconClass(false)}>
                      <Store className="h-[18px] w-[18px]" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium text-xs">
                  {activeStore?.name ?? "Seleziona store"}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuLabel className="px-3 py-2 text-xs text-muted-foreground">
                  Seleziona Store
                </DropdownMenuLabel>
                {stores.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => setActiveStore(s)}
                    className={`text-[13px] ${activeStore?.id === s.id ? "bg-accent" : ""}`}
                  >
                    <Store className="mr-2.5 h-4 w-4" />
                    {s.name}
                  </DropdownMenuItem>
                ))}
                {canManageStores && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate("/manage-stores")}
                      className="text-[13px] text-primary font-medium"
                    >
                      <Settings className="mr-2.5 h-4 w-4" />
                      Gestisci Store
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className={iconClass(false)}
                aria-label="Cambia tema"
              >
                {theme === "dark" ? (
                  <Sun className="h-[18px] w-[18px]" />
                ) : (
                  <Moon className="h-[18px] w-[18px]" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium text-xs">
              {theme === "dark" ? "Tema chiaro" : "Tema scuro"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className={`${iconClass(false)} hover:text-destructive`}
                aria-label="Esci"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium text-xs">Esci</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
