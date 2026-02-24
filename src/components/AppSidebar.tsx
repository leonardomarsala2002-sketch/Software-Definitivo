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
    <aside className="hidden md:flex w-20 flex-col h-screen py-3 pl-3">
      <div className="flex flex-col h-full">
      {/* Top Section: Logo + Navigation */}
      <div className="flex flex-col items-center pt-4 pb-2">
        {/* Logo */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 shadow-[0_0_20px_rgba(255,255,255,0.08)] mb-4">
          <UtensilsCrossed className="h-5 w-5" />
        </div>
      </div>

      <Separator className="mx-4 w-auto opacity-10" />

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col items-center py-4 space-y-2 overflow-y-auto">
        {mainItems.map((item) => {
          const active = isActive(item.url);
          return (
            <Tooltip key={item.url}>
              <TooltipTrigger asChild>
                <Link
                  to={item.url}
                  aria-label={item.title}
                  className="flex items-center justify-center p-1"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200
                      ${active
                        ? "text-white shadow-[0_0_16px_rgba(255,255,255,0.25)]"
                        : "text-white/50 hover:text-white/80"
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
            <Separator className="mx-2 my-2 w-10 opacity-10" />
            {secondaryItems.map((item) => {
              const active = isActive(item.url);
              return (
                <Tooltip key={item.url}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.url}
                      aria-label={item.title}
                      className="flex items-center justify-center p-1"
                    >
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200
                          ${active
                            ? "text-white shadow-[0_0_16px_rgba(255,255,255,0.25)]"
                            : "text-white/50 hover:text-white/80"
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
        <Separator className="mx-4 w-10 opacity-10" />

        {/* Store Selector */}
        {stores.length > 1 ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-11 w-11 items-center justify-center rounded-full text-white/50 hover:text-white/80 transition-all duration-200">
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
              <div className="flex h-11 w-11 items-center justify-center rounded-full text-white/50">
                <Store className="h-5 w-5" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {activeStore.name}
            </TooltipContent>
          </Tooltip>
        ) : null}

        {/* Logout - round floating icon */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className="flex h-11 w-11 items-center justify-center rounded-full text-red-400 hover:text-red-300 hover:shadow-[0_0_12px_rgba(248,113,113,0.25)] transition-all duration-200"
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
