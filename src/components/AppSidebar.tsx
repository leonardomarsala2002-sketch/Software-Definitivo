import { navItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UtensilsCrossed } from "lucide-react";
import { useLocation } from "react-router-dom";

export function AppSidebar() {
  const { role } = useAuth();
  const { state } = useSidebar();
  const location = useLocation();
  const filtered = filterNavByRole(navItems, role);
  const mainItems = filtered.filter((i) => i.section === "main");
  const secondaryItems = filtered.filter((i) => i.section === "secondary");

  const isCollapsed = state === "collapsed";

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center justify-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="ml-3 flex flex-col">
              <span className="text-[15px] font-bold tracking-tight text-foreground">Shift Scheduler</span>
              <span className="text-[11px] font-medium text-muted-foreground">Restaurant Manager</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Separator className="mx-3 w-auto opacity-60" />

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          {!isCollapsed && (
            <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Menu principale
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5">
              {mainItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={item.title} className="h-auto p-0">
                      <a
                        href={item.url}
                        className={`flex items-center transition-all ${isCollapsed ? "justify-center py-2" : "gap-3 px-2 py-2"}`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all
                            ${active 
                              ? "bg-primary text-primary-foreground shadow-md" 
                              : "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80"
                            }`}
                        >
                          <item.icon className="h-[18px] w-[18px]" />
                        </div>
                        {!isCollapsed && (
                          <span className={`text-[13px] font-medium ${active ? "text-foreground font-semibold" : "text-sidebar-foreground"}`}>
                            {item.title}
                          </span>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          {!isCollapsed && (
            <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Configurazione
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5">
              {secondaryItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={item.title} className="h-auto p-0">
                      <a
                        href={item.url}
                        className={`flex items-center transition-all ${isCollapsed ? "justify-center py-2" : "gap-3 px-2 py-2"}`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all
                            ${active 
                              ? "bg-primary text-primary-foreground shadow-md" 
                              : "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80"
                            }`}
                        >
                          <item.icon className="h-[18px] w-[18px]" />
                        </div>
                        {!isCollapsed && (
                          <span className={`text-[13px] font-medium ${active ? "text-foreground font-semibold" : "text-sidebar-foreground"}`}>
                            {item.title}
                          </span>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={`px-3 py-4 ${isCollapsed ? "hidden" : ""}`}>
        <p className="text-[10px] text-muted-foreground/50">© 2026 Shift Scheduler</p>
      </SidebarFooter>
    </Sidebar>
  );
}
