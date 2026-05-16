import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogOut, User, Store, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { navItems } from "@/config/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const roleLabelMap: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  store_manager: "Store Manager",
  employee: "Dipendente",
};

const roleBadgeColor: Record<string, string> = {
  super_admin: "bg-gradient-to-r from-[#635bff] to-[#4f46e5] text-white border-transparent",
  admin: "bg-[#d1fae5] text-[#065f46] border-transparent",
  store_manager: "bg-[#fef3c7] text-[#92400e] border-transparent",
  employee: "bg-[#f3f4f8] text-[#6b7280] border-transparent",
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
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
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
      <header className="flex h-14 shrink-0 items-center gap-4 px-6 bg-white border-b border-[#e4e7ec]">
        <h1 className="text-[15px] font-bold tracking-tight text-[#0f1117] whitespace-nowrap">
          {pageTitle}
        </h1>

        {role === "super_admin" && stores.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" data-tutorial="store-switcher">
                <Store className="h-3.5 w-3.5" />
                <span className="hidden sm:inline max-w-[120px] truncate">{activeStore?.name ?? "Store"}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-xl border-[#e4e7ec] shadow-card">
              {stores.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => setActiveStore(s)} className={`text-[13px] rounded-lg ${activeStore?.id === s.id ? "bg-[#f5f3ff] text-[#635bff]" : ""}`}>
                  <Store className="mr-2 h-3.5 w-3.5" />{s.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = "/manage-stores"} className="text-[13px] text-[#635bff] rounded-lg">
                <Plus className="mr-2 h-3.5 w-3.5" />Aggiungi store
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : activeStore && role !== "employee" ? (
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-[#6b7280] bg-[#f3f4f8] rounded-lg px-2.5 py-1.5 border border-[#e4e7ec]">
            <Store className="h-3.5 w-3.5" />{activeStore.name}
          </span>
        ) : null}

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-[#635bff] focus:ring-offset-2 transition-transform hover:scale-105"
                data-tutorial="header-profile"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-[#635bff] to-[#4f46e5] text-xs font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-[#e4e7ec] shadow-card">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold text-[#0f1117]">{displayName}</p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold mt-1 ${roleBadgeColor[role ?? "employee"]}`}>
                  {roleLabelMap[role ?? ""] || role}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[13px] rounded-lg" onClick={() => setProfileOpen(true)}>
                <User className="mr-2 h-4 w-4" />Profilo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-[13px] text-[#ef4444] focus:text-[#ef4444] focus:bg-[#fee2e2] rounded-lg">
                <LogOut className="mr-2 h-4 w-4" />Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md rounded-2xl border-[#e4e7ec] shadow-card-hover">
          <DialogHeader>
            <div className="h-1.5 -mx-6 -mt-6 mb-4 rounded-t-2xl bg-gradient-to-r from-[#635bff] to-[#00d4aa]" />
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-gradient-to-br from-[#635bff] to-[#4f46e5] text-sm font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold text-[#0f1117]">{profileData?.profile?.full_name ?? displayName}</p>
                <Badge variant="violet" className="text-[10px] mt-0.5">
                  {roleLabelMap[profileData?.role ?? role ?? ""] ?? "—"}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2.5 pt-2">
            <ProfileRow label="Email" value={profileData?.profile?.email ?? user?.email} />
            <ProfileRow label="Nome" value={profileData?.details ? `${profileData.details.first_name ?? ""} ${profileData.details.last_name ?? ""}`.trim() || null : null} />
            <ProfileRow label="Telefono" value={profileData?.details?.phone} />
            <ProfileRow label="Data di nascita" value={profileData?.details?.birth_date} />
            <ProfileRow label="Codice fiscale" value={profileData?.details?.fiscal_code} />
            <ProfileRow label="Residenza" value={profileData?.details?.residence} />
            <ProfileRow label="Reparto" value={profileData?.details?.department === "sala" ? "Sala" : profileData?.details?.department === "cucina" ? "Cucina" : profileData?.details?.department} />
            <ProfileRow label="Mansione" value={profileData?.details?.role_label} />
            <ProfileRow label="Contratto" value={profileData?.details?.contract_type} />
            <ProfileRow label="Ore settimanali" value={profileData?.details?.weekly_contract_hours?.toString()} />
            <ProfileRow label="Data assunzione" value={profileData?.details?.hire_date} />
            {profileData?.stores && profileData.stores.length > 0 && (
              <div className="pt-2 border-t border-[#e4e7ec]">
                <p className="text-[11px] font-medium text-[#6b7280] mb-1.5">Store assegnati</p>
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
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-[#f3f4f8] last:border-0">
      <span className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm ${value ? "text-[#0f1117] font-medium" : "text-[#c4c9d4]"}`}>{value || "—"}</span>
    </div>
  );
}
