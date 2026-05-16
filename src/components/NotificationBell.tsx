import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, FileText, CalendarCheck, CalendarClock,
  CheckCircle2, XCircle, AlertTriangle, ArrowRightLeft,
} from "lucide-react";
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
  draft_ready:         { icon: FileText,        color: "text-sky-600",     bg: "bg-sky-50"      },
  shifts_published:    { icon: CalendarCheck,   color: "text-emerald-600", bg: "bg-emerald-50"  },
  shift_updated:       { icon: CalendarClock,   color: "text-blue-600",    bg: "bg-blue-50"     },
  request_approved:    { icon: CheckCircle2,    color: "text-emerald-600", bg: "bg-emerald-50"  },
  request_rejected:    { icon: XCircle,         color: "text-red-600",     bg: "bg-red-50"      },
  coverage_problem:    { icon: AlertTriangle,   color: "text-amber-600",   bg: "bg-amber-50"    },
  lending_request:     { icon: ArrowRightLeft,  color: "text-violet-600",  bg: "bg-violet-50"   },
};

const defaultConfig = { icon: Bell, color: "text-sky-600", bg: "bg-sky-50" };

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
        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 hover:bg-slate-50",
        !n.is_read && "bg-sky-50/50"
      )}
    >
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", cfg.bg)}>
        <Icon className={cn("h-4 w-4", cfg.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] leading-tight truncate", !n.is_read ? "font-semibold text-slate-900" : "font-medium text-slate-600")}>
          {n.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{n.message}</p>
        <p className="mt-1 text-[10px] text-slate-400">{timeAgo(n.created_at)}</p>
      </div>
      {!n.is_read && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
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
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Notifiche</h4>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              className="text-[11px] font-medium text-sky-600 hover:text-sky-700 transition-colors"
              onClick={() => userId && markAllAsRead.mutate(userId)}
              disabled={markAllAsRead.isPending}
            >
              Segna tutte lette
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 mb-3">
                <Bell className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Tutto in ordine</p>
              <p className="text-xs text-slate-400 mt-1">Nessuna notifica</p>
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
