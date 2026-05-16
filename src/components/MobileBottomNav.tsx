import { useLocation, Link } from "react-router-dom";
import { bottomNavItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

export function MobileBottomNav() {
  const location = useLocation();
  const { role, cyclePreviewRole, previewRole, isPreviewMode } = useAuth();
  const visibleItems = filterNavByRole(bottomNavItems, role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-slate-200 md:hidden safe-area-bottom shadow-[0_-1px_0_0_rgba(0,0,0,0.06)]">
      {isPreviewMode && (
        <div className="flex items-center justify-center bg-sky-50 border-b border-slate-200 py-1.5">
          <button
            onClick={cyclePreviewRole}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95",
              previewRole ? "bg-sky-600 text-white" : "text-sky-600 hover:text-sky-700"
            )}
          >
            <Eye className="h-3 w-3" />
            {previewRole
              ? `Preview: ${previewRole === "super_admin" ? "SA" : previewRole === "admin" ? "Admin" : previewRole === "store_manager" ? "SM" : "Emp"}`
              : "Preview ruolo"}
          </button>
        </div>
      )}
      <div className="flex h-16 items-center justify-around px-1 pb-1">
        {visibleItems.map((item) => {
          const isActive =
            item.url === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              data-tutorial={item.tutorialId}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-2 min-w-[3.5rem] transition-all active:scale-95",
                isActive ? "text-sky-700" : "text-slate-400"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150",
                  isActive ? "bg-sky-50" : "hover:bg-slate-100"
                )}
              >
                <item.icon className={cn("h-4.5 w-4.5", isActive ? "text-sky-600" : "text-slate-400")} />
              </div>
              <span className={cn(
                "text-[10px] leading-none",
                isActive ? "font-bold text-sky-700" : "font-medium"
              )}>
                {item.title.length > 8 ? item.title.split(" ")[0] : item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
