import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, FileText, CalendarCheck, CalendarClock,
  CheckCircle2, XCircle, AlertTriangle, ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import {
  useUnreadNotifications, useMarkAsRead, useMarkAllAsRead,
  type Notification,
} from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  draft_ready:         { icon: FileText,        color: "text-[#635bff]", bg: "bg-[#f5f3ff]" },
  shifts_published:    { icon: CalendarCheck,   color: "text-[#10b981]", bg: "bg-[#d1fae5]" },
  shift_updated:       { icon: CalendarClock,   color: "text-[#3b82f6]", bg: "bg-[#dbeafe]" },
  request_approved:    { icon: CheckCircle2,    color: "text-[#10b981]", bg: "bg-[#d1fae5]" },
  request_rejected:    { icon: XCircle,         color: "text-[#ef4444]", bg: "bg-[#fee2e2]" },
  coverage_problem:    { icon: AlertTriangle,   color: "text-[#f59e0b]", bg: "bg-[#fef3c7]" },
  lending_request:     { icon: ArrowRightLeft,  color: "text-[#6366f1]", bg: "bg-[#ede9fe]" },
};

const defaultConfig = { icon: Bell, color: "text-[#635bff]", bg: "bg-[#f5f3ff]" };

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

function NotificationItem({ n, onRead }: { n: Notification; onRead: (n: Notification) => void }) {
  const cfg = typeConfig[n.type] || defaultConfig;
  const Icon = cfg.icon;

  return (
    <button
      type="button"
      onClick={() => onRead(n)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 hover:bg-[#f3f4f8]",
        !n.is_read && "bg-[#fafafe]"
      )}
    >
      <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", cfg.bg)}>
        <Icon className={cn("h-4 w-4", cfg.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13px] leading-tight", !n.is_read ? "font-semibold text-[#0f1117]" : "font-medium text-[#6b7280]")}>
          {n.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#6b7280]">{n.message}</p>
        <p className="mt-1 text-[10px] text-[#c4c9d4]">{timeAgo(n.created_at)}</p>
      </div>
      {!n.is_read && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#635bff]" />
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

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  const handleRead = (n: Notification) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl hover:bg-[#f3f4f8] text-[#6b7280] hover:text-[#0f1117]"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#635bff] px-1 text-[10px] font-bold text-white shadow-button-violet">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-0 shadow-card-hover border-[#e4e7ec] sm:w-96">
        {/* Header with gradient line */}
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-[#635bff] to-[#00d4aa]" />
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-[#0f1117]">Notifiche</h4>
            {unreadCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#635bff] text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              className="text-[11px] font-medium text-[#635bff] hover:text-[#4f46e5] transition-colors"
              onClick={() => userId && markAllAsRead.mutate(userId)}
              disabled={markAllAsRead.isPending}
            >
              Segna tutte lette
            </button>
          )}
        </div>
        <Separator className="bg-[#f3f4f8]" />
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5f3ff] mb-3">
                <Bell className="h-6 w-6 text-[#635bff]" />
              </div>
              <p className="text-sm font-semibold text-[#0f1117]">Tutto in ordine!</p>
              <p className="text-xs text-[#6b7280] mt-1">Nessuna notifica da leggere</p>
            </div>
          ) : (
            <div className="p-2">
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
