import { useLocation, Link } from "react-router-dom";
import { bottomNavItems } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {bottomNavItems.map((item) => {
          const isActive =
            item.url === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate max-w-[4.5rem]">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
