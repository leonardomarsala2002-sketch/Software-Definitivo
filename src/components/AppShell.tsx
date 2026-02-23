import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getAccentColorForPath } from "@/config/navigation";

// Accent color background classes for each section
const accentBackgrounds: Record<string, string> = {
  blue: "bg-blue-50/30 dark:bg-blue-950/10",
  green: "bg-green-50/30 dark:bg-green-950/10",
  amber: "bg-amber-50/30 dark:bg-amber-950/10",
  purple: "bg-purple-50/30 dark:bg-purple-950/10",
  rose: "bg-rose-50/30 dark:bg-rose-950/10",
};

export function AppShell() {
  const location = useLocation();
  const accentColor = getAccentColorForPath(location.pathname);
  const bgClass = accentBackgrounds[accentColor] || accentBackgrounds.blue;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <main className={`flex-1 overflow-auto ${bgClass} transition-colors duration-300 px-5 py-4 pb-24 md:px-6 md:py-4 md:pb-4`}>
          <Outlet />
        </main>
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
