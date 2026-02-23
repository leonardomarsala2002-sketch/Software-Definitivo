import { useLocation, Link } from "react-router-dom";
import { bottomNavItems, filterNavByRole } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// Glow classes for each accent color
const glowClasses: Record<string, string> = {
  blue: "emoji-glow-blue",
  green: "emoji-glow-green",
  amber: "emoji-glow-amber",
  purple: "emoji-glow-purple",
  rose: "emoji-glow-rose",
};

// Border colors for active state
const borderColors: Record<string, string> = {
  blue: "border-blue-500",
  green: "border-green-500",
  amber: "border-amber-500",
  purple: "border-purple-500",
  rose: "border-rose-500",
};

interface MobileBottomNavProps {
  accentColor?: string;
}

export function MobileBottomNav({ accentColor = "blue" }: MobileBottomNavProps) {
  const location = useLocation();
  const { role } = useAuth();
  const visibleItems = filterNavByRole(bottomNavItems, role);

  return (
    <nav className="fixed inset-x-4 bottom-4 z-50 rounded-[28px] border border-border/40 bg-card/95 backdrop-blur-lg shadow-2xl md:hidden">
      <div className="flex h-[4.25rem] items-center justify-around px-2">
        {visibleItems.map((item) => {
          const isActive =
            item.url === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.url);
          const itemAccent = item.accentColor || "blue";
          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all duration-300"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 text-lg border-2",
                  isActive 
                    ? `bg-white dark:bg-white/10 ${borderColors[itemAccent]} ${glowClasses[itemAccent]}` 
                    : "bg-accent/50 border-transparent"
                )}
              >
                <span role="img" aria-label={item.title}>{item.emoji}</span>
              </div>
              <span className={cn(
                "text-[10px] leading-none transition-colors duration-300",
                isActive ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
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
