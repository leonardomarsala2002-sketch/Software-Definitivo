import { navItems, filterNavByRole } from "@/config/navigation";
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
import { Store, LogOut, User, Sun, Moon } from "lucide-react";
import { useLocation, Link } from "react-router-dom";

// Glow classes for each accent color
const glowClasses: Record<string, string> = {
  blue: "emoji-glow-blue",
  green: "emoji-glow-green",
  amber: "emoji-glow-amber",
  purple: "emoji-glow-purple",
  rose: "emoji-glow-rose",
};

// Border colors for active state
const borderColors: Record<string, string> = {
  blue: "border-blue-500 dark:border-blue-400",
  green: "border-green-500 dark:border-green-400",
  amber: "border-amber-500 dark:border-amber-400",
  purple: "border-purple-500 dark:border-purple-400",
  rose: "border-rose-500 dark:border-rose-400",
};

// Get accent color for a given path
const getAccentForPath = (url: string): string => {
  const item = navItems.find(i => i.url === url);
  return item?.accentColor || "blue";
};

interface AppSidebarProps {
  accentColor?: string;
}

export function AppSidebar({ accentColor = "blue" }: AppSidebarProps) {
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
      className="hidden md:flex w-[72px] flex-col h-full bg-sidebar border-r border-sidebar-border select-none rounded-l-[40px]"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Main Navigation */}
      <nav aria-label="Menu principale" className="flex-1 flex flex-col items-center py-6 gap-3 overflow-y-auto">
        {mainItems.map((item) => {
          const active = isActive(item.url);
          const itemAccent = getAccentForPath(item.url);
          return (
            <Tooltip key={item.url}>
              <TooltipTrigger asChild>
                <Link
                  to={item.url}
                  className="flex items-center justify-center"
                  draggable={false}
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 border-2 text-xl
                      ${active 
                        ? `bg-white dark:bg-white/10 ${borderColors[itemAccent]} ${glowClasses[itemAccent]}` 
                        : `bg-sidebar-accent/50 border-transparent hover:bg-sidebar-accent hover:scale-105`
                      }`}
                  >
                    <span role="img" aria-label={item.title}>{item.emoji}</span>
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium rounded-xl">
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
              const itemAccent = getAccentForPath(item.url);
              return (
                <Tooltip key={item.url}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.url}
                      className="flex items-center justify-center"
                      draggable={false}
                    >
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 border-2 text-xl
                          ${active 
                            ? `bg-white dark:bg-white/10 ${borderColors[itemAccent]} ${glowClasses[itemAccent]}` 
                            : `bg-sidebar-accent/50 border-transparent hover:bg-sidebar-accent hover:scale-105`
                          }`}
                      >
                        <span role="img" aria-label={item.title}>{item.emoji}</span>
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium rounded-xl">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom Section: Theme Toggle, Locale, Store, Profile - stacked vertically */}
      <div className="mt-auto flex flex-col items-center pb-6 gap-3">
        <Separator className="mx-4 w-8 opacity-40" />

        {/* Theme Toggle - Miniaturized Switch */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/50 hover:bg-sidebar-accent transition-all duration-300 hover:scale-105"
            >
              {isDarkMode ? (
                <Moon className="h-4 w-4 text-blue-400" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium rounded-xl">
            {isDarkMode ? "Modalità chiara" : "Modalità scura"}
          </TooltipContent>
        </Tooltip>

        {/* Locale Selector - Store emoji 🏢 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/50 hover:bg-sidebar-accent transition-all duration-300 hover:scale-105">
              <span className="text-base">🏢</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium rounded-xl">
            Lingua: Italiano
          </TooltipContent>
        </Tooltip>

        {/* Store Selector (if multiple stores) */}
        {stores.length > 1 ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-300 hover:scale-105">
                    <Store className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium rounded-xl">
                {activeStore?.name ?? "Seleziona store"}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="end" className="w-56 rounded-2xl p-1.5 shadow-lg">
              <DropdownMenuLabel className="px-3 py-2 text-xs text-muted-foreground">
                Seleziona Store
              </DropdownMenuLabel>
              {stores.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => setActiveStore(s)}
                  className={`rounded-xl px-3 py-2 text-[13px] ${activeStore?.id === s.id ? "bg-accent" : ""}`}
                >
                  <Store className="mr-2.5 h-4 w-4" />
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {/* User Profile Avatar */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="flex h-11 w-11 items-center justify-center rounded-full hover:ring-2 hover:ring-primary/20 transition-all duration-300">
                  <Avatar className="h-10 w-10 shadow-md">
                    <AvatarFallback className="bg-primary/10 text-[12px] font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium rounded-xl">
              {displayName}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="end" className="w-52 rounded-2xl p-1.5 shadow-lg">
            <DropdownMenuLabel className="rounded-xl px-3 py-2.5 font-normal">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-muted-foreground">{role ? roleLabelMap[role] || role : ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-xl px-3 py-2 text-[13px]">
              <User className="mr-2.5 h-4 w-4" />
              Profilo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="rounded-xl px-3 py-2 text-[13px] text-destructive focus:text-destructive"
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
