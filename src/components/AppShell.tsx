import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getAccentColorForPath } from "@/config/navigation";

// Accent color border classes for each section - applied to widgets
const accentBorders: Record<string, string> = {
  blue: "border-blue-400/40 dark:border-blue-500/30",
  green: "border-green-400/40 dark:border-green-500/30",
  amber: "border-amber-400/40 dark:border-amber-500/30",
  purple: "border-purple-400/40 dark:border-purple-500/30",
  rose: "border-rose-400/40 dark:border-rose-500/30",
};

export function AppShell() {
  const location = useLocation();
  const accentColor = getAccentColorForPath(location.pathname);

  return (
    <SidebarProvider>
      {/* Page background (zinc satin gray) is set via body in index.css */}
      <div className="h-screen w-screen p-4 md:p-6 overflow-hidden">
        {/* Main Island Container */}
        <div className="flex h-full w-full rounded-[40px] bg-background overflow-hidden shadow-2xl">
          <AppSidebar accentColor={accentColor} />
          <main className="flex-1 overflow-hidden transition-colors duration-300 p-4 md:p-6">
            <Outlet context={{ accentColor, accentBorders }} />
          </main>
          <MobileBottomNav accentColor={accentColor} />
        </div>
      </div>
    </SidebarProvider>
  );
}
