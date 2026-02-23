import { navItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { UtensilsCrossed, Store, LogOut, User } from "lucide-react";
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
  "/personal-calendar": { bg: "bg-teal-100", bgHover: "hover:bg-teal-50", text: "text-teal-600", darkBg: "dark:bg-teal-900/40", darkBgHover: "dark:hover:bg-teal-900/30", darkText: "dark:text-teal-400", border: "border-teal-500", darkBorder: "dark:border-teal-400" },
  "/requests": { bg: "bg-amber-100", bgHover: "hover:bg-amber-50", text: "text-amber-600", darkBg: "dark:bg-amber-900/40", darkBgHover: "dark:hover:bg-amber-900/30", darkText: "dark:text-amber-400", border: "border-amber-500", darkBorder: "dark:border-amber-400" },
  "/employees": { bg: "bg-purple-100", bgHover: "hover:bg-purple-50", text: "text-purple-600", darkBg: "dark:bg-purple-900/40", darkBgHover: "dark:hover:bg-purple-900/30", darkText: "dark:text-purple-400", border: "border-purple-500", darkBorder: "dark:border-purple-400" },
  "/store-settings": { bg: "bg-rose-100", bgHover: "hover:bg-rose-50", text: "text-rose-600", darkBg: "dark:bg-rose-900/40", darkBgHover: "dark:hover:bg-rose-900/30", darkText: "dark:text-rose-400", border: "border-rose-500", darkBorder: "dark:border-rose-400" },
  "/audit-log": { bg: "bg-slate-100", bgHover: "hover:bg-slate-50", text: "text-slate-600", darkBg: "dark:bg-slate-800/40", darkBgHover: "dark:hover:bg-slate-800/30", darkText: "dark:text-slate-400", border: "border-slate-500", darkBorder: "dark:border-slate-400" },
};

const getColorForPath = (url: string): SectionColorConfig => {
  return sectionColors[url] || sectionColors["/"];
};

export function AppSidebar() {
  const { role, user, stores, activeStore, setActiveStore, signOut } = useAuth();
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

  return (
    <aside 
      className="hidden md:flex w-20 flex-col h-screen bg-sidebar border-r border-sidebar-border select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Top Section: Logo + Navigation */}
      <div className="flex flex-col items-center pt-4 pb-2">
        {/* Logo */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md mb-4">
          <UtensilsCrossed className="h-5 w-5" />
        </div>
      </div>

      <Separator className="mx-4 w-auto opacity-40" />

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col items-center py-4 gap-3 overflow-y-auto">
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
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 border-2
                      ${active 
                        ? `${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText} ${colors.border} ${colors.darkBorder} shadow-md` 
                        : `bg-sidebar-accent/50 text-sidebar-foreground border-transparent ${colors.bgHover} ${colors.darkBgHover} hover:text-sidebar-accent-foreground`
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
                      className="flex items-center justify-center"
                      draggable={false}
                    >
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 border-2
                          ${active 
                            ? `${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText} ${colors.border} ${colors.darkBorder} shadow-md` 
                            : `bg-sidebar-accent/50 text-sidebar-foreground border-transparent ${colors.bgHover} ${colors.darkBgHover} hover:text-sidebar-accent-foreground`
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

      {/* Bottom Section: Store, Profile */}
      <div className="mt-auto flex flex-col items-center pb-4 gap-3">
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

        {/* User Profile */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="flex h-11 w-11 items-center justify-center rounded-full hover:ring-2 hover:ring-primary/20 transition-all duration-200">
                  <Avatar className="h-10 w-10 shadow-sm">
                    <AvatarFallback className="bg-primary/10 text-[13px] font-semibold text-primary">
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
