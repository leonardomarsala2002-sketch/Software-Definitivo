import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { EyeOff } from "lucide-react";

export function AppShell() {
  const { isViewingAsEmployee, toggleViewAsEmployee } = useAuth();

  return (
    <div className="flex h-screen w-full overflow-hidden gradient-bg">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* View as Employee banner */}
        {isViewingAsEmployee && (
          <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium md:px-6">
            <div className="flex items-center gap-2">
              <EyeOff className="h-3.5 w-3.5" />
              <span>Stai visualizzando l'app come un <strong>Dipendente</strong>. Le modifiche non sono possibili in questa modalità.</span>
            </div>
            <button
              onClick={toggleViewAsEmployee}
              className="text-[11px] font-bold text-amber-900 hover:text-amber-700 underline underline-offset-2 transition-colors whitespace-nowrap"
            >
              Torna ad Admin
            </button>
          </div>
        )}
        <div className="flex-1 overflow-hidden scrollbar-hide px-4 py-3 pb-20 md:px-6 md:py-4 md:pb-4">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
