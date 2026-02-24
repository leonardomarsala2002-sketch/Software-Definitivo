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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UtensilsCrossed, Store, LogOut } from "lucide-react";
import { useLocation, Link } from "react-router-dom";

export function AppSidebar() {
  const { role, stores, activeStore, setActiveStore, signOut } = useAuth();
  const location = useLocation();
  const filtered = filterNavByRole(navItems, role);
  const mainItems = filtered.filter((i) => i.section === "main");
  const secondaryItems = filtered.filter((i) => i.section === "secondary");

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <aside className="hidden md:flex w-20 flex-col h-screen py-4 pl-3 items-center glass-sidebar border-r border-[rgba(0,200,83,0.08)]">
      <div className="flex flex-col h-full items-center">
        {/* Logo */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-lg mb-6">
          <UtensilsCrossed className="h-5 w-5 text-[#333]" />
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 flex flex-col items-center py-2 space-y-3 overflow-y-auto">
          {mainItems.map((item) => {
            const active = isActive(item.url);
            return (
              <Tooltip key={item.url}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.url}
                    aria-label={item.title}
                    className="flex items-center justify-center"
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200
                        ${active
                          ? "bg-white shadow-lg text-[#00C853]"
                          : "bg-white/50 shadow-md text-[#666] hover:bg-white hover:shadow-lg hover:text-[#333]"
                        }`}
                    >
                      <item.icon className="h-5 w-5" />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.title}
                </TooltipContent>
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
                      <Link
                        to={item.url}
                        aria-label={item.title}
                        className="flex items-center justify-center"
                      >
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200
                            ${active
                              ? "bg-white shadow-lg text-[#00C853]"
                              : "bg-white/50 shadow-md text-[#666] hover:bg-white hover:shadow-lg hover:text-[#333]"
                            }`}
                        >
                          <item.icon className="h-5 w-5" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </>
          )}
        </nav>

        {/* Bottom Section: Store + Logout */}
        <div className="mt-auto flex flex-col items-center pb-4 space-y-3">
          {stores.length > 1 ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/50 shadow-md text-[#666] hover:bg-white hover:shadow-lg hover:text-[#333] transition-all duration-200">
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
              </DropdownMenuContent>
            </DropdownMenu>
          ) : activeStore ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/50 shadow-md text-[#666]">
                  <Store className="h-5 w-5" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {activeStore.name}
              </TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/50 shadow-md text-[#666] hover:bg-white hover:shadow-lg hover:text-destructive transition-all duration-200"
                aria-label="Esci"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Esci
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
