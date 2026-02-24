import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden gradient-bg">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden scrollbar-hide px-4 py-3 pb-20 md:px-6 md:py-4 md:pb-4">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
