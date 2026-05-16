import { Outlet } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";

export function AppShell() {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <AppHeader />
      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 py-5 pb-20 md:px-8 md:py-6 md:pb-6">
        <Outlet />
      </main>
      <MobileBottomNav />
      <TutorialProvider />
    </div>
  );
}
