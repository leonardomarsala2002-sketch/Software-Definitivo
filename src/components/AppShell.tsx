import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden px-5 py-6 pb-24 md:px-8 md:py-6 md:pb-6">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
