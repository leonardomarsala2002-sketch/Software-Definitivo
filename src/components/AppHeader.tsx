import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Store, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navItems } from "@/config/navigation";

const roleLabelMap: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  employee: "Dipendente",
};

function usePageTitle(): string {
  const { pathname } = useLocation();
  const match = navItems.find((item) =>
    item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)
  );
  if (match) return match.title;
  if (pathname.startsWith("/manage-stores")) return "Gestione Store";
  if (pathname.startsWith("/invitations")) return "Inviti";
  if (pathname.startsWith("/personal-calendar")) return "Calendario Personale";
  return "Dashboard";
}

export function AppHeader() {
  const { user, role, stores, activeStore, setActiveStore, signOut } = useAuth();
  const pageTitle = usePageTitle();

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  const displayName = user?.user_metadata?.full_name || user?.email || "Utente";

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 px-6">
      {/* Page title */}
      <h1 className="text-lg font-semibold tracking-tight text-foreground whitespace-nowrap">
        {pageTitle}
      </h1>

      {/* Store selector (compact) */}
      {role !== "employee" && stores.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Store className="h-3.5 w-3.5" />
              <span className="hidden sm:inline max-w-[120px] truncate">{activeStore?.name ?? "Store"}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {stores.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => setActiveStore(s)}
                className={`text-[13px] ${activeStore?.id === s.id ? "bg-accent" : ""}`}
              >
                <Store className="mr-2 h-3.5 w-3.5" />
                {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : activeStore ? (
        <span className="text-xs text-muted-foreground hidden sm:inline">{activeStore.name}</span>
      ) : null}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search bar */}
      <div className="hidden md:flex relative max-w-xs w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Cerca..."
          className="h-9 pl-9 rounded-xl bg-secondary border-transparent text-sm focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1 md:hidden" />

      {/* Right section */}
      <div className="flex items-center gap-2">
        <NotificationBell />

        {/* User avatar menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-muted-foreground">{role ? roleLabelMap[role] || role : ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[13px]">
              <User className="mr-2 h-4 w-4" />
              Profilo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-[13px] text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
