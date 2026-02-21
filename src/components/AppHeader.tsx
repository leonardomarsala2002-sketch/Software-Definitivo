import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, LogOut, Store, User } from "lucide-react";
import { toast } from "sonner";

export function AppHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/60 bg-card/80 px-5 backdrop-blur-sm md:px-8">
      <SidebarTrigger className="hidden md:flex" />

      {/* Store selector placeholder */}
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2.5 rounded-xl border-border/60 bg-background px-4 text-[13px] font-medium shadow-sm hover:shadow"
      >
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Store Milano Duomo</span>
        <span className="sm:hidden">Milano Duomo</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
      </Button>

      <div className="flex-1" />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 w-10 rounded-full p-0 hover:bg-accent">
            <Avatar className="h-9 w-9 shadow-sm">
              <AvatarFallback className="bg-accent text-[13px] font-semibold text-accent-foreground">
                MR
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 shadow-lg">
          <DropdownMenuLabel className="rounded-lg px-3 py-2.5 font-normal">
            <p className="text-sm font-semibold">Marco Rossi</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="rounded-lg px-3 py-2 text-[13px]">
            <User className="mr-2.5 h-4 w-4" />
            Profilo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toast.info("Logout non ancora implementato")}
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
