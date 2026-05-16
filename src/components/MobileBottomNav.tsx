import { useLocation, Link } from "react-router-dom";
import { bottomNavItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SA",
  admin: "A",
  store_manager: "SM",
  employee: "E",
};

export function MobileBottomNav() {
  const location = useLocation();
  const { role, cyclePreviewRole, previewRole, isPreviewMode } = useAuth();
  const visibleItems = filterNavByRole(bottomNavItems, role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-[#e4e7ec] md:hidden safe-area-bottom shadow-[0_-4px_24px_rgba(99,91,255,0.08)]">
      {isPreviewMode && (
        <div className="flex items-center justify-center bg-[#f5f3ff] border-b border-[#e4e7ec] py-1.5">
          <button
            onClick={cyclePreviewRole}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95",
              previewRole
                ? "bg-[#635bff] text-white"
                : "text-[#635bff] hover:text-[#4f46e5]"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            {previewRole
              ? `Preview: ${previewRole === "super_admin" ? "Super Admin" : previewRole === "admin" ? "Admin" : previewRole === "store_manager" ? "SM" : "Emp"}`
              : "Preview ruolo"}
            {previewRole && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] font-bold text-[#635bff] leading-none">
                {ROLE_LABELS[previewRole]}
              </span>
            )}
          </button>
        </div>
      )}
      <div className="flex h-[4.5rem] items-center justify-around px-1 pb-1">
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
                "flex flex-col items-center gap-1 rounded-2xl px-3 py-2 min-w-[3.5rem] transition-all active:scale-95",
                isActive ? "text-[#635bff]" : "text-[#9ca3af]"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-br from-[#f5f3ff] to-[#ede9fe] shadow-[0_2px_8px_rgba(99,91,255,0.2)]"
                    : "hover:bg-[#f3f4f8]"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-[#635bff]" : "text-[#9ca3af]")} />
              </div>
              <span className={cn(
                "text-[10px] leading-none font-medium",
                isActive ? "font-bold text-[#635bff]" : ""
              )}>
                {item.title.length > 10 ? item.title.split(" ")[0] : item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
