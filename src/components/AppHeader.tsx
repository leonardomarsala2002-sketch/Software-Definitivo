import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, LogOut, Store, User, Sun, Moon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export function AppHeader() {
  const { user, role, stores, activeStore, setActiveStore, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

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
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/60 bg-card/80 px-5 backdrop-blur-sm md:px-8">
      <SidebarTrigger className="hidden md:flex" />

      {/* Store selector */}
      {stores.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2.5 rounded-xl border-border/60 bg-background px-4 text-[13px] font-medium shadow-sm hover:shadow"
            >
              <Store className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">{activeStore?.name ?? "Seleziona store"}</span>
              <span className="sm:hidden">{activeStore?.name?.split(" ").pop() ?? "Store"}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5 shadow-lg">
            {stores.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => setActiveStore(s)}
                className="rounded-lg px-3 py-2 text-[13px]"
              >
                <Store className="mr-2.5 h-4 w-4" />
                {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : activeStore ? (
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-none h-9 gap-2.5 rounded-xl border-border/60 bg-background px-4 text-[13px] font-medium shadow-sm"
        >
          <Store className="h-4 w-4 text-muted-foreground" />
          <span>{activeStore.name}</span>
        </Button>
      ) : null}

      <div className="flex-1" />

      {/* Theme Switch */}
      <div className="flex items-center gap-2">
        <Sun className={`h-4 w-4 transition-colors ${isDarkMode ? 'text-muted-foreground' : 'text-amber-500'}`} />
        <Switch
          id="theme-switch"
          checked={isDarkMode}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          className="data-[state=checked]:bg-slate-700 data-[state=unchecked]:bg-amber-400"
        />
        <Moon className={`h-4 w-4 transition-colors ${isDarkMode ? 'text-blue-400' : 'text-muted-foreground'}`} />
        <Label htmlFor="theme-switch" className="sr-only">
          {isDarkMode ? "Modalità scura attiva" : "Modalità chiara attiva"}
        </Label>
      </div>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 w-10 rounded-full p-0 hover:bg-accent">
            <Avatar className="h-9 w-9 shadow-sm">
              <AvatarFallback className="bg-accent text-[13px] font-semibold text-accent-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 shadow-lg">
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
    </header>
  );
}
