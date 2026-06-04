import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { InnerHeader } from "@/components/InnerHeader";
import { BottomNav } from "@/components/BottomNav";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";

export function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar — desktop only */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <InnerHeader />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />

      <TutorialProvider />
    </div>
  );
}
