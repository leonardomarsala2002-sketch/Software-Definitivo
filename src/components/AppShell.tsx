import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden p-3 gap-1.5">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden scrollbar-hide px-8 py-8 pb-20 md:px-8 md:py-8 md:pb-8">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
