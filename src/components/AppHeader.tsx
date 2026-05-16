import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogOut, User, Store, ChevronDown, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { navItems, filterNavByRole } from "@/config/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const roleLabelMap: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  store_manager: "Store Manager",
  employee: "Dipendente",
};

export function AppHeader() {
  const { user, role, stores, activeStore, setActiveStore, signOut, cyclePreviewRole, previewRole, isPreviewMode } = useAuth();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const filtered = filterNavByRole(navItems, role);
  const allNavItems = filtered;

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

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
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 md:px-6 bg-white border-b border-slate-200 z-30">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-600">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="hidden sm:block text-[15px] font-bold text-slate-900 tracking-tight">Shift Scheduler</span>
        </Link>

        <div className="hidden md:flex items-center h-full mx-2 w-px bg-slate-200 shrink-0" />

        {/* Desktop Nav links */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
          {allNavItems.map((item) => {
            const active = isActive(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                data-tutorial={item.tutorialId}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all duration-150",
                  active
                    ? "bg-sky-50 text-sky-700 font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                <item.icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-sky-600" : "text-slate-400")} />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 md:flex-none" />

        {/* Right controls */}
        <div className="flex items-center gap-1.5">
          {/* Preview mode indicator */}
          {isPreviewMode && (
            <button
              onClick={cyclePreviewRole}
              className={cn(
                "hidden sm:flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                previewRole ? "bg-sky-100 text-sky-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              )}
            >
              <Eye className="h-3 w-3" />
              {previewRole ? (roleLabelMap[previewRole] ?? previewRole) : "Preview"}
            </button>
          )}

          {/* Store selector (super_admin) */}
          {role === "super_admin" && stores.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs px-2.5" data-tutorial="store-switcher">
                  <Store className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline max-w-[90px] truncate">{activeStore?.name ?? "Store"}</span>
                  <ChevronDown className="h-3 w-3 opacity-40 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {stores.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => setActiveStore(s)}
                    className={cn("text-[13px]", activeStore?.id === s.id && "bg-sky-50 text-sky-700")}
                  >
                    <Store className="mr-2 h-3.5 w-3.5" />{s.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => window.location.href = "/manage-stores"}
                  className="text-[13px] text-sky-600"
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />Aggiungi store
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : activeStore && role !== "employee" ? (
            <span className="hidden md:flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-md px-2 py-1">
              <Store className="h-3 w-3 shrink-0" />{activeStore.name}
            </span>
          ) : null}

          <NotificationBell />

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-sky-600 text-[10px] font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{roleLabelMap[role ?? ""] || role}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[13px]" onClick={() => setProfileOpen(true)}>
                <User className="mr-2 h-4 w-4" />Profilo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-[13px] text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="mr-2 h-4 w-4" />Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-sky-600 text-sm font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold text-slate-900">{profileData?.profile?.full_name ?? displayName}</p>
                <Badge variant="info" className="text-[10px] mt-0.5">
                  {roleLabelMap[profileData?.role ?? role ?? ""] ?? "—"}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1 pt-2">
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
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-medium text-slate-400 mb-1.5">Store assegnati</p>
                <div className="flex flex-wrap gap-1.5">
                  {profileData.stores.map((s: any) => (
                    <Badge key={s.store_id} variant={s.is_primary ? "default" : "secondary"} className="text-[11px]">
                      {(s.stores as any)?.name ?? s.store_id}{s.is_primary && " ★"}
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
    <div className="flex items-start gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm ${value ? "text-slate-900 font-medium" : "text-slate-300"}`}>{value || "—"}</span>
    </div>
  );
}
