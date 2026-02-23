import { navItems, filterNavByRole, getAccentColorForPath } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
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
import { Store, LogOut, User, Sun, Moon, Globe } from "lucide-react";
import { useLocation, Link } from "react-router-dom";

// Type for section color configuration
interface SectionColorConfig {
  bg: string;
  bgHover: string;
  text: string;
  darkBg: string;
  darkBgHover: string;
  darkText: string;
  border: string;
  darkBorder: string;
}

// Dynamic color themes for each navigation section with bright borders
const sectionColors: Record<string, SectionColorConfig> = {
  "/": { bg: "bg-blue-100", bgHover: "hover:bg-blue-50", text: "text-blue-600", darkBg: "dark:bg-blue-900/40", darkBgHover: "dark:hover:bg-blue-900/30", darkText: "dark:text-blue-400", border: "border-blue-500", darkBorder: "dark:border-blue-400" },
  "/team-calendar": { bg: "bg-green-100", bgHover: "hover:bg-green-50", text: "text-green-600", darkBg: "dark:bg-green-900/40", darkBgHover: "dark:hover:bg-green-900/30", darkText: "dark:text-green-400", border: "border-green-500", darkBorder: "dark:border-green-400" },
  "/requests": { bg: "bg-amber-100", bgHover: "hover:bg-amber-50", text: "text-amber-600", darkBg: "dark:bg-amber-900/40", darkBgHover: "dark:hover:bg-amber-900/30", darkText: "dark:text-amber-400", border: "border-amber-500", darkBorder: "dark:border-amber-400" },
  "/employees": { bg: "bg-purple-100", bgHover: "hover:bg-purple-50", text: "text-purple-600", darkBg: "dark:bg-purple-900/40", darkBgHover: "dark:hover:bg-purple-900/30", darkText: "dark:text-purple-400", border: "border-purple-500", darkBorder: "dark:border-purple-400" },
  "/store-settings": { bg: "bg-rose-100", bgHover: "hover:bg-rose-50", text: "text-rose-600", darkBg: "dark:bg-rose-900/40", darkBgHover: "dark:hover:bg-rose-900/30", darkText: "dark:text-rose-400", border: "border-rose-500", darkBorder: "dark:border-rose-400" },
};

const getColorForPath = (url: string): SectionColorConfig => {
  return sectionColors[url] || sectionColors["/"];
};

export function AppSidebar() {
  const { role, user, stores, activeStore, setActiveStore, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const filtered = filterNavByRole(navItems, role);
  const mainItems = filtered.filter((i) => i.section === "main");
  const secondaryItems = filtered.filter((i) => i.section === "secondary");

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  const displayName = user?.user_metadata?.full_name || user?.email || "Utente";
  const roleLabelMap: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    employee: "Dipendente",
  };

  const isDarkMode = theme === "dark";

  return (
    <aside 
      className="hidden md:flex w-16 flex-col h-screen bg-sidebar border-r border-sidebar-border select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Main Navigation */}
      <nav aria-label="Menu principale" className="flex-1 flex flex-col items-center py-4 gap-2 overflow-y-auto">
        {mainItems.map((item) => {
          const active = isActive(item.url);
          const colors = getColorForPath(item.url);
          return (
            <Tooltip key={item.url}>
              <TooltipTrigger asChild>
                <Link
                  to={item.url}
                  className="flex items-center justify-center"
                  draggable={false}
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 border-2 text-lg
                      ${active 
                        ? `${colors.bg} ${colors.darkBg} ${colors.border} ${colors.darkBorder} shadow-md` 
                        : `bg-sidebar-accent/50 border-transparent ${colors.bgHover} ${colors.darkBgHover}`
                      }`}
                  >
                    <span role="img" aria-label={item.title}>{item.emoji}</span>
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
            <Separator className="mx-2 my-2 w-8 opacity-40" />
            {secondaryItems.map((item) => {
              const active = isActive(item.url);
              const colors = getColorForPath(item.url);
              return (
                <Tooltip key={item.url}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.url}
                      className="flex items-center justify-center"
                      draggable={false}
                    >
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 border-2 text-lg
                          ${active 
                            ? `${colors.bg} ${colors.darkBg} ${colors.border} ${colors.darkBorder} shadow-md` 
                            : `bg-sidebar-accent/50 border-transparent ${colors.bgHover} ${colors.darkBgHover}`
                          }`}
                      >
                        <span role="img" aria-label={item.title}>{item.emoji}</span>
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

      {/* Bottom Section: Theme Toggle, Locale, Store, Profile */}
      <div className="mt-auto flex flex-col items-center pb-4 gap-3">
        <Separator className="mx-4 w-8 opacity-40" />

        {/* Theme Toggle - Miniaturized */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/50 hover:bg-sidebar-accent transition-all duration-200"
            >
              {isDarkMode ? (
                <Moon className="h-4 w-4 text-blue-400" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {isDarkMode ? "Modalità chiara" : "Modalità scura"}
          </TooltipContent>
        </Tooltip>

        {/* Locale Selector */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/50 hover:bg-sidebar-accent transition-all duration-200">
              <span className="text-base">🇮🇹</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Lingua: Italiano
          </TooltipContent>
        </Tooltip>

        {/* Store Selector */}
        {stores.length > 1 ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200">
                    <Store className="h-4 w-4" />
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
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/50 text-sidebar-foreground">
                <Store className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {activeStore.name}
            </TooltipContent>
          </Tooltip>
        ) : null}

        {/* User Profile */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="flex h-10 w-10 items-center justify-center rounded-full hover:ring-2 hover:ring-primary/20 transition-all duration-200">
                  <Avatar className="h-9 w-9 shadow-sm">
                    <AvatarFallback className="bg-primary/10 text-[12px] font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {displayName}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="end" className="w-52 rounded-xl p-1.5 shadow-lg">
            <DropdownMenuLabel className="rounded-lg px-3 py-2.5 font-normal">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-muted-foreground">{role ? roleLabelMap[role] || role : ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-lg px-3 py-2 text-[13px]">
              <User className="mr-2.5 h-4 w-4" />
              Profilo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="rounded-lg px-3 py-2 text-[13px] text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2.5 h-4 w-4" />
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
