import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { InnerHeader } from "@/components/InnerHeader";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <InnerHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <TutorialProvider />
    </div>
  );
}
