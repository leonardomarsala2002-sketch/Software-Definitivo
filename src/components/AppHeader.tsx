import { useState } from "react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LogOut, User, Store, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { navItems } from "@/config/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  const displayName = user?.user_metadata?.full_name || user?.email || "Utente";

  const { data: profileData } = useQuery({
    queryKey: ["my-profile-detail", user?.id],
    queryFn: async () => {
      const [{ data: profile }, { data: details }, { data: roleData }, { data: storeAssigns }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("employee_details").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_store_assignments").select("store_id, is_primary, stores(name)").eq("user_id", user!.id),
      ]);
      return { profile, details, role: roleData?.role, stores: storeAssigns ?? [] };
    },
    enabled: !!user?.id && profileOpen,
  });

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-4 px-6">
        <h1 className="text-lg font-semibold tracking-tight text-foreground whitespace-nowrap">
          {pageTitle}
        </h1>

        {role === "super_admin" && stores.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground">
                <Store className="h-3.5 w-3.5" />
                <span className="hidden sm:inline max-w-[120px] truncate">{activeStore?.name ?? "Store"}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {stores.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => setActiveStore(s)} className={`text-[13px] ${activeStore?.id === s.id ? "bg-accent" : ""}`}>
                  <Store className="mr-2 h-3.5 w-3.5" />{s.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = "/manage-stores"} className="text-[13px] text-primary">
                <Plus className="mr-2 h-3.5 w-3.5" />Aggiungi store
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : activeStore && role !== "employee" ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground hidden sm:inline-flex">
            <Store className="h-3.5 w-3.5" />{activeStore.name}
          </span>
        ) : null}

        <div className="flex-1" />

        <div className="hidden md:flex relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Cerca..." className="h-9 pl-9 rounded-xl bg-secondary border-transparent text-sm focus-visible:ring-1 focus-visible:ring-ring" />
        </div>

        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-2">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">{role ? roleLabelMap[role] || role : ""}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[13px]" onClick={() => setProfileOpen(true)}>
                <User className="mr-2 h-4 w-4" />Profilo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-[13px] text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold">{profileData?.profile?.full_name ?? displayName}</p>
                <Badge variant="outline" className="text-[10px] mt-0.5">
                  {roleLabelMap[profileData?.role ?? role ?? ""] ?? "—"}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <ProfileRow label="Email" value={profileData?.profile?.email ?? user?.email} />
            {profileData?.details && (
              <>
                <ProfileRow label="Nome" value={`${profileData.details.first_name ?? ""} ${profileData.details.last_name ?? ""}`.trim()} />
                <ProfileRow label="Telefono" value={profileData.details.phone} />
                <ProfileRow label="Reparto" value={profileData.details.department === "sala" ? "Sala" : profileData.details.department === "cucina" ? "Cucina" : profileData.details.department} />
                <ProfileRow label="Contratto" value={profileData.details.contract_type} />
                <ProfileRow label="Ore settimanali" value={profileData.details.weekly_contract_hours?.toString()} />
                <ProfileRow label="Livello" value={profileData.details.level} />
                <ProfileRow label="Mansione" value={profileData.details.role_label} />
                <ProfileRow label="Data assunzione" value={profileData.details.hire_date} />
                <ProfileRow label="Codice fiscale" value={profileData.details.fiscal_code} />
                <ProfileRow label="Residenza" value={profileData.details.residence} />
                <ProfileRow label="Domicilio" value={profileData.details.domicile} />
              </>
            )}
            {profileData?.stores && profileData.stores.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Store assegnati</p>
                <div className="flex flex-wrap gap-1.5">
                  {profileData.stores.map((s: any) => (
                    <Badge key={s.store_id} variant={s.is_primary ? "default" : "secondary"} className="text-[11px]">
                      {(s.stores as any)?.name ?? s.store_id}
                      {s.is_primary && " ★"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] font-medium text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
