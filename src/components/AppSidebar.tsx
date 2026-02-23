import { navItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
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
import { UtensilsCrossed, Store, Moon, Sun } from "lucide-react";
import { useLocation, Link } from "react-router-dom";

// Type for section color configuration
interface SectionColorConfig {
  bg: string;
  bgHover: string;
  text: string;
  darkBg: string;
  darkBgHover: string;
  darkText: string;
  ring: string;
  darkRing: string;
}

// Dynamic color themes for each navigation section
const sectionColors: Record<string, SectionColorConfig> = {
  "/": { bg: "bg-blue-200/80", bgHover: "hover:bg-blue-50", text: "text-blue-700", darkBg: "dark:bg-blue-800/50", darkBgHover: "dark:hover:bg-blue-900/30", darkText: "dark:text-blue-300", ring: "ring-blue-500", darkRing: "dark:ring-blue-400" },
  "/team-calendar": { bg: "bg-green-200/80", bgHover: "hover:bg-green-50", text: "text-green-700", darkBg: "dark:bg-green-800/50", darkBgHover: "dark:hover:bg-green-900/30", darkText: "dark:text-green-300", ring: "ring-green-500", darkRing: "dark:ring-green-400" },
  "/requests": { bg: "bg-amber-200/80", bgHover: "hover:bg-amber-50", text: "text-amber-700", darkBg: "dark:bg-amber-800/50", darkBgHover: "dark:hover:bg-amber-900/30", darkText: "dark:text-amber-300", ring: "ring-amber-500", darkRing: "dark:ring-amber-400" },
  "/employees": { bg: "bg-purple-200/80", bgHover: "hover:bg-purple-50", text: "text-purple-700", darkBg: "dark:bg-purple-800/50", darkBgHover: "dark:hover:bg-purple-900/30", darkText: "dark:text-purple-300", ring: "ring-purple-500", darkRing: "dark:ring-purple-400" },
  "/store-settings": { bg: "bg-rose-200/80", bgHover: "hover:bg-rose-50", text: "text-rose-700", darkBg: "dark:bg-rose-800/50", darkBgHover: "dark:hover:bg-rose-900/30", darkText: "dark:text-rose-300", ring: "ring-rose-500", darkRing: "dark:ring-rose-400" },
  "/audit-log": { bg: "bg-slate-200/80", bgHover: "hover:bg-slate-50", text: "text-slate-700", darkBg: "dark:bg-slate-700/50", darkBgHover: "dark:hover:bg-slate-800/30", darkText: "dark:text-slate-300", ring: "ring-slate-500", darkRing: "dark:ring-slate-400" },
};

const getColorForPath = (url: string): SectionColorConfig => {
  return sectionColors[url] || sectionColors["/"];
};

export function AppSidebar() {
  const { role, stores, activeStore, setActiveStore, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const filtered = filterNavByRole(navItems, role);
  const mainItems = filtered.filter((i) => i.section === "main");
  const secondaryItems = filtered.filter((i) => i.section === "secondary");

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <aside className="hidden md:flex w-20 flex-col h-screen bg-sidebar border-r border-sidebar-border">
      {/* Top Section: Logo + Navigation */}
      <div className="flex flex-col items-center pt-4 pb-2">
        {/* Logo */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md mb-4">
          <UtensilsCrossed className="h-5 w-5" />
        </div>
      </div>

      <Separator className="mx-4 w-auto opacity-40" />

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col items-center py-4 space-y-2 overflow-y-auto">
        {mainItems.map((item) => {
          const active = isActive(item.url);
          const colors = getColorForPath(item.url);
          return (
            <Tooltip key={item.url}>
              <TooltipTrigger asChild>
                <Link
                  to={item.url}
                  className="flex items-center justify-center p-1"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200
                      ${active 
                        ? `${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText} shadow-lg ring-2 ${colors.ring} ${colors.darkRing}` 
                        : `bg-sidebar-accent/50 text-sidebar-foreground hover:scale-110`
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
            <Separator className="mx-2 my-2 w-10 opacity-40" />
            {secondaryItems.map((item) => {
              const active = isActive(item.url);
              const colors = getColorForPath(item.url);
              return (
                <Tooltip key={item.url}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.url}
                      className="flex items-center justify-center p-1"
                    >
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200
                          ${active 
                            ? `${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText} shadow-lg ring-2 ${colors.ring} ${colors.darkRing}` 
                            : `bg-sidebar-accent/50 text-sidebar-foreground hover:scale-110`
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

      {/* Bottom Section: Theme Toggle, Store, Profile */}
      <div className="mt-auto flex flex-col items-center pb-4 space-y-3">
        {/* Theme Toggle - Switch Style */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleTheme}
              className="relative flex h-7 w-12 items-center rounded-full bg-sidebar-accent/60 transition-all duration-300"
              aria-label={theme === "dark" ? "Modalità chiara" : "Modalità scura"}
            >
              <span
                className={`absolute flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-all duration-300 dark:bg-slate-700
                  ${theme === "dark" ? "left-6" : "left-1"}`}
              >
                {theme === "dark" ? (
                  <Moon className="h-3 w-3 text-blue-300" />
                ) : (
                  <Sun className="h-3 w-3 text-amber-500" />
                )}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {theme === "dark" ? "Modalità chiara" : "Modalità scura"}
          </TooltipContent>
        </Tooltip>

        <Separator className="mx-4 w-10 opacity-40" />

        {/* Store Selector */}
        {stores.length > 1 ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-11 w-11 items-center justify-center rounded-full bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200">
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
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sidebar-accent/50 text-sidebar-foreground">
                <Store className="h-5 w-5" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {activeStore.name}
            </TooltipContent>
          </Tooltip>
        ) : null}

        {/* Logout */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-sidebar-accent/50 text-sidebar-foreground hover:scale-110 transition-all duration-200"
              aria-label="Logout"
            >
              <span className="text-xl leading-none">🚪</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Logout
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
