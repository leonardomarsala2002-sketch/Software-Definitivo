import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden px-4 py-4 pb-20 md:px-6 md:py-4 md:pb-4">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
