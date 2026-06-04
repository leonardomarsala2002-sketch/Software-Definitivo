import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, User, LogOut, Store, ChevronDown, Plus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/team-calendar": "Scheduler",
  "/admin-shifts": "Orari Admin",
  "/employees": "Dipendenti",
  "/store-settings": "Impostazioni Store",
  "/requests": "Richieste",
  "/ai-assistant": "AI Assistant",
  "/audit-log": "Audit Log",
  "/manage-stores": "Gestione Store",
  "/invitations": "Inviti",
  "/personal-calendar": "Il Mio Calendario",
  "/profile": "Il Mio Profilo",
  "/settings": "Impostazioni",
  "/scheduler": "Scheduler",
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  store_manager: "Manager",
  employee: "Dipendente",
};

export function InnerHeader() {
  const { user, role, stores, activeStore, setActiveStore, signOut } = useAuth();
  const location = useLocation();

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([path]) =>
      path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)
    )?.[1] ?? "Shift Scheduler";

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Utente";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const canGenerateShifts = ["admin", "store_manager", "super_admin"].includes(role ?? "");

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm md:px-6 z-30">
      {/* Logo mobile (lg nasconde la sidebar, mostriamo brand qui) */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
          <Zap className="h-3 w-3 text-white" />
        </div>
      </div>

      {/* Page title */}
      <h1 className="text-[15px] font-bold text-foreground tracking-tight">{pageTitle}</h1>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Store selector (super_admin) */}
        {role === "super_admin" && stores.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                <Store className="h-3.5 w-3.5" />
                <span className="hidden sm:inline max-w-[80px] truncate">
                  {activeStore?.name ?? "Store"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-40" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {stores.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => setActiveStore(s)}
                  className={cn(
                    "text-[13px]",
                    activeStore?.id === s.id && "bg-accent text-primary"
                  )}
                >
                  <Store className="mr-2 h-3.5 w-3.5" />
                  {s.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => (window.location.href = "/manage-stores")}
                className="text-[13px] text-primary"
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Aggiungi store
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Genera Turni CTA */}
        {canGenerateShifts && (
          <Button
            asChild
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold shadow-sm active:scale-95 transition-all"
          >
            <Link to="/team-calendar">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Genera Turni</span>
            </Link>
          </Button>
        )}

        <NotificationBell />

        {/* Avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full ring-2 ring-transparent transition-all hover:ring-primary/20 focus:outline-none focus-visible:ring-primary/40">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-[10px] font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold text-foreground">{displayName}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {ROLE_LABEL[role ?? ""] ?? role}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-[13px]">
              <Link to="/profile">
                <User className="mr-2 h-4 w-4" />
                Profilo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-[13px] text-destructive focus:text-destructive focus:bg-destructive/10"
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
