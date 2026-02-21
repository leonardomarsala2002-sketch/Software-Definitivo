import { useLocation, Link } from "react-router-dom";
import { bottomNavItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const location = useLocation();
  const { role } = useAuth();
  const visibleItems = filterNavByRole(bottomNavItems, role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-lg md:hidden">
      <div className="flex h-[4.25rem] items-center justify-around px-1 pb-1">
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
                "flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                  isActive && "bg-accent shadow-sm"
                )}
              >
                <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-accent-foreground")} />
              </div>
              <span className={cn(
                "text-[10px] leading-none",
                isActive ? "font-semibold" : "font-medium"
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
