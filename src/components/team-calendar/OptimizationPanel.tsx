import { useState } from "react";
import { AlertTriangle, UserMinus, ArrowRightLeft, Clock, ChevronDown, ChevronUp, Check, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { OptimizationSuggestion } from "@/hooks/useOptimizationSuggestions";

interface OptimizationPanelProps {
  suggestions: OptimizationSuggestion[];
  onAccept: (suggestion: OptimizationSuggestion) => void;
  onDecline: (suggestionId: string) => void;
  onNavigateToDay?: (date: string) => void;
}

const typeConfig = {
  uncovered: {
    icon: AlertTriangle,
    color: "text-destructive",
    bg: "bg-destructive/5 border-destructive/20",
    badge: "destructive" as const,
    badgeLabel: "Critico",
  },
  surplus: {
    icon: UserMinus,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40",
    badge: "outline" as const,
    badgeLabel: "Surplus",
  },
  lending: {
    icon: ArrowRightLeft,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50/80 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40",
    badge: "outline" as const,
    badgeLabel: "Prestito",
  },
  overtime_balance: {
    icon: Clock,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50/80 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-800/40",
    badge: "outline" as const,
    badgeLabel: "Monte Ore",
  },
};

export function OptimizationPanel({
  suggestions,
  onAccept,
  onDecline,
  onNavigateToDay,
}: OptimizationPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.id));
  const criticalCount = visibleSuggestions.filter(s => s.severity === "critical").length;
  const warningCount = visibleSuggestions.filter(s => s.severity === "warning").length;
  const infoCount = visibleSuggestions.filter(s => s.severity === "info").length;

  if (visibleSuggestions.length === 0) return null;

  const handleDecline = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    onDecline(id);
  };

  return (
    <div className="mb-4 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Pannello Ottimizzazione
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                {criticalCount} critici
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-300">
                {warningCount} avvisi
              </Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {infoCount} info
              </Badge>
            )}
          </div>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Body */}
      {!collapsed && (
        <ScrollArea className="max-h-[320px]">
          <div className="px-4 pb-3 space-y-2">
            {visibleSuggestions.map(suggestion => {
              const config = typeConfig[suggestion.type];
              const Icon = config.icon;

              return (
                <div
                  key={suggestion.id}
                  className={cn(
                    "rounded-lg border p-3 transition-all",
                    config.bg
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-foreground">{suggestion.title}</span>
                        <Badge variant={config.badge} className="text-[9px] px-1 py-0 h-3.5">
                          {config.badgeLabel}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 text-[10px] px-2.5 gap-1"
                          onClick={() => {
                            if (suggestion.type === "uncovered" && suggestion.date && onNavigateToDay) {
                              onNavigateToDay(suggestion.date);
                            } else {
                              onAccept(suggestion);
                              handleDecline(suggestion.id);
                            }
                          }}
                        >
                          {suggestion.type === "uncovered" ? (
                            <ExternalLink className="h-2.5 w-2.5" />
                          ) : (
                            <Check className="h-2.5 w-2.5" />
                          )}
                          {suggestion.actionLabel}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2.5 gap-1 text-muted-foreground"
                          onClick={() => handleDecline(suggestion.id)}
                        >
                          <X className="h-2.5 w-2.5" />
                          {suggestion.declineLabel}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
