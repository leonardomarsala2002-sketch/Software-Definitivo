import { useLocation, Link } from "react-router-dom";
import { bottomNavItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SA",
  admin: "A",
  employee: "E",
};

export function MobileBottomNav() {
  const location = useLocation();
  const { role, cyclePreviewRole, previewRole, isPreviewMode } = useAuth();
  const visibleItems = filterNavByRole(bottomNavItems, role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background md:hidden safe-area-bottom">
      {/* Preview role bar – only in preview */}
      {isPreviewMode && (
        <div className="flex items-center justify-center border-b border-border bg-muted/50 py-1.5 gap-2">
          <button
            onClick={cyclePreviewRole}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors active:scale-95",
              previewRole
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            {previewRole
              ? `Preview: ${previewRole === "super_admin" ? "Super Admin" : previewRole === "admin" ? "Admin" : "Dipendente"}`
              : "Preview ruolo"}
            {previewRole && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground leading-none">
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
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl px-4 py-2.5 min-w-[3rem] min-h-[2.75rem] transition-all active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                  isActive && "border-2 border-primary bg-primary/10"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              </div>
              <span className={cn(
                "text-[10px] leading-none",
                isActive ? "font-semibold text-primary" : "font-medium"
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
