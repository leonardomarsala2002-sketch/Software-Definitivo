import { navItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Store, LogOut, Eye, Settings } from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SA",
  admin: "A",
  employee: "E",
};

export function AppSidebar() {
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
    `glass-icon-card !rounded-full flex h-11 w-11 items-center justify-center transition-all duration-200 ${
      active
        ? "border-2 border-[#00C853] text-[#00C853]"
        : "text-[#666] hover:text-[#333]"
    }`;

  return (
    <aside className="hidden md:flex w-20 flex-col h-full">
      <div className="flex flex-col h-full items-center py-4">
        {/* Logo placeholder */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-lg mb-6" />

        {/* Preview role switch — only in preview environment */}
        {isPreviewMode && (
          <div className="mb-3 px-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={cyclePreviewRole}
                  className={`glass-icon-card flex h-9 w-9 items-center justify-center relative transition-colors ${
                    previewRole
                      ? "text-[#00C853] ring-1 ring-[#00C853]/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  {previewRole && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#00C853] text-[8px] font-bold text-white leading-none">
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
        <nav className="flex-1 flex flex-col items-center py-2 space-y-3 overflow-y-auto">
          {mainItems.map((item) => {
            const active = isActive(item.url);
            return (
              <Tooltip key={item.url}>
                <TooltipTrigger asChild>
                  <Link to={item.url} aria-label={item.title} className="flex items-center justify-center">
                    <div className={iconClass(active)}>
                      <item.icon className="h-5 w-5" />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{item.title}</TooltipContent>
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
                          <item.icon className="h-5 w-5" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">{item.title}</TooltipContent>
                  </Tooltip>
                );
              })}
            </>
          )}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto flex flex-col items-center pb-4 space-y-3">
          {/* Store Selector – hidden for employees */}
          {role !== "employee" && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className={iconClass(false)}>
                      <Store className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {activeStore?.name ?? "Seleziona store"}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="right" align="end" className="w-56 rounded-xl p-1.5 shadow-lg">
                <DropdownMenuLabel className="px-3 py-2 text-xs text-muted-foreground">
                  Seleziona Store
                </DropdownMenuLabel>
                {stores.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => setActiveStore(s)}
                    className={`rounded-lg px-3 py-2 text-[13px] ${activeStore?.id === s.id ? "bg-accent" : ""}`}
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
                      className="rounded-lg px-3 py-2 text-[13px] text-[#00C853] font-medium"
                    >
                      <Settings className="mr-2.5 h-4 w-4" />
                      Gestisci Store
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className={`${iconClass(false)} hover:text-destructive`}
                aria-label="Esci"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Esci</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
