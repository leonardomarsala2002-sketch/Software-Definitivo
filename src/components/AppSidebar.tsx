import { NavLink } from "@/components/NavLink";
import { navItems } from "@/config/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UtensilsCrossed } from "lucide-react";

const mainItems = navItems.filter((i) => i.section === "main");
const secondaryItems = navItems.filter((i) => i.section === "secondary");

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-[15px] font-bold tracking-tight text-foreground">Shift Scheduler</span>
            <span className="text-[11px] font-medium text-muted-foreground">Restaurant Manager</span>
          </div>
        </div>
      </SidebarHeader>

      <Separator className="mx-4 w-auto opacity-60" />

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Menu principale
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title} className="h-10 rounded-xl px-3">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="text-[13px] font-medium text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-accent text-accent-foreground font-semibold shadow-sm"
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Configurazione
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title} className="h-10 rounded-xl px-3">
                    <NavLink
                      to={item.url}
                      className="text-[13px] font-medium text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-accent text-accent-foreground font-semibold shadow-sm"
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-5 py-4 group-data-[collapsible=icon]:hidden">
        <p className="text-[10px] text-muted-foreground/50">© 2026 Shift Scheduler</p>
      </SidebarFooter>
    </Sidebar>
  );
}
