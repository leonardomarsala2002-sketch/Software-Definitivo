import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  FileText,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import {
  useUnreadNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  type Notification,
} from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, React.ElementType> = {
  draft_ready: FileText,
  shifts_published: CalendarCheck,
  shift_updated: CalendarClock,
  request_approved: CheckCircle2,
  request_rejected: XCircle,
  coverage_problem: AlertTriangle,
  lending_request: ArrowRightLeft,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ora";
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g fa`;
  return `${Math.floor(days / 7)}s fa`;
}

function NotificationItem({
  n,
  onRead,
}: {
  n: Notification;
  onRead: (n: Notification) => void;
}) {
  const Icon = typeIcons[n.type] || Bell;

  return (
    <button
      type="button"
      onClick={() => onRead(n)}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50",
        !n.is_read && "bg-primary/5"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          !n.is_read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[13px] leading-tight",
            !n.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80"
          )}
        >
          {n.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {n.message}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</p>
      </div>
      {!n.is_read && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: notifications = [] } = useUnreadNotifications(userId);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const navigate = useNavigate();

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const handleRead = (n: Notification) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-accent">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-xl p-0 shadow-xl sm:w-96"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-sm font-semibold">Notifiche</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => userId && markAllAsRead.mutate(userId)}
              disabled={markAllAsRead.isPending}
            >
              Segna tutte come lette
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nessuna notifica</p>
            </div>
          ) : (
            <div className="p-1.5">
              {notifications.slice(0, 20).map((n) => (
                <NotificationItem key={n.id} n={n} onRead={handleRead} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
