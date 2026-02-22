import { useState, useMemo } from "react";
import {
  AlertTriangle, UserMinus, ArrowRightLeft, Clock, ChevronDown, ChevronUp,
  Check, X, ExternalLink, Zap, TrendingDown, Stethoscope, Shield,
  Scale, Users, Search, Scissors, Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { OptimizationSuggestion } from "@/hooks/useOptimizationSuggestions";

interface OptimizationPanelProps {
  suggestions: OptimizationSuggestion[];
  onAccept: (suggestion: OptimizationSuggestion) => void;
  onDecline: (suggestionId: string) => void;
  onApplyAll: () => void;
  onNavigateToDay?: (date: string) => void;
}

type GroupKey = "critical" | "equity" | "lending";

interface GroupConfig {
  key: GroupKey;
  label: string;
  icon: React.ElementType;
  color: string;
  bgCard: string;
  bgHeader: string;
  dot: string;
}

const GROUP_CONFIG: GroupConfig[] = [
  {
    key: "critical",
    label: "Azioni Critiche",
    icon: Shield,
    color: "text-destructive",
    bgCard: "bg-destructive/5 border-destructive/20",
    bgHeader: "bg-destructive/8",
    dot: "bg-destructive",
  },
  {
    key: "equity",
    label: "Ottimizzazione Equità",
    icon: Scale,
    color: "text-amber-600 dark:text-amber-400",
    bgCard: "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/40",
    bgHeader: "bg-amber-50 dark:bg-amber-950/30",
    dot: "bg-amber-500",
  },
  {
    key: "lending",
    label: "Opportunità di Prestito",
    icon: Users,
    color: "text-blue-600 dark:text-blue-400",
    bgCard: "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/40",
    bgHeader: "bg-blue-50 dark:bg-blue-950/30",
    dot: "bg-blue-500",
  },
];

function classifyGroup(s: OptimizationSuggestion): GroupKey {
  if (s.type === "uncovered") return "critical";
  if (s.type === "lending") return "lending";
  return "equity"; // surplus, overtime_balance, hour_reduction
}

function isSicknessRelated(s: OptimizationSuggestion): boolean {
  const desc = (s.description ?? "").toLowerCase();
  return desc.includes("malattia") || desc.includes("sickness") || desc.includes("emergenz");
}

function humanizeTitle(s: OptimizationSuggestion): string {
  if (s.type === "uncovered") {
    const dept = s.description?.toLowerCase().includes("cucina") ? "Cucina" : "Sala";
    const time = s.slot ?? "";
    const dateStr = s.date ? new Date(s.date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric" }) : "";
    if (time && dateStr) return `Manca 1 persona in ${dept} alle ${time} — ${dateStr}`;
    return s.title;
  }
  return s.title;
}

export function OptimizationPanel({
  suggestions,
  onAccept,
  onDecline,
  onApplyAll,
  onNavigateToDay,
}: OptimizationPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<GroupKey>>(new Set());

  const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.id));

  // Sort: sickness-related first within each group
  const sorted = useMemo(() => {
    return [...visibleSuggestions].sort((a, b) => {
      const ga = classifyGroup(a);
      const gb = classifyGroup(b);
      const groupOrder: Record<GroupKey, number> = { critical: 0, equity: 1, lending: 2 };
      if (groupOrder[ga] !== groupOrder[gb]) return groupOrder[ga] - groupOrder[gb];
      const sa = isSicknessRelated(a) ? 0 : 1;
      const sb = isSicknessRelated(b) ? 0 : 1;
      return sa - sb;
    });
  }, [visibleSuggestions]);

  const grouped = useMemo(() => {
    const map: Record<GroupKey, OptimizationSuggestion[]> = { critical: [], equity: [], lending: [] };
    for (const s of sorted) map[classifyGroup(s)].push(s);
    return map;
  }, [sorted]);

  // Health check metrics
  const totalSlots = suggestions.length || 1;
  const uncoveredCount = visibleSuggestions.filter(s => s.type === "uncovered").length;
  const coveragePercent = Math.round(((totalSlots - uncoveredCount) / totalSlots) * 100);
  const equityItems = grouped.equity.length;
  const equityLabel = equityItems === 0 ? "Bilanciata" : `${equityItems} da ottimizzare`;
  const actionableCount = visibleSuggestions.filter(s => s.type !== "uncovered").length;
  const hasSickness = visibleSuggestions.some(isSicknessRelated);

  if (visibleSuggestions.length === 0) return null;

  const handleDecline = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    onDecline(id);
  };

  const handleAccept = (suggestion: OptimizationSuggestion) => {
    if (suggestion.type === "uncovered" && suggestion.date && onNavigateToDay) {
      onNavigateToDay(suggestion.date);
    } else {
      onAccept(suggestion);
      setDismissedIds(prev => new Set(prev).add(suggestion.id));
    }
  };

  const toggleGroup = (key: GroupKey) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getContextualAction = (s: OptimizationSuggestion) => {
    if (s.type === "uncovered") {
      return { label: "Trova Sostituto", icon: Search };
    }
    if (s.type === "surplus" || s.type === "overtime_balance") {
      return { label: "Bilancia Riposi", icon: Scale };
    }
    if (s.type === "hour_reduction") {
      return { label: "Aggiungi Spezzato", icon: Scissors };
    }
    if (s.type === "lending") {
      return { label: "Accetta Prestito", icon: ArrowRightLeft };
    }
    return { label: s.actionLabel, icon: Check };
  };

  return (
    <div className="mb-4 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Health Check Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Heart className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-foreground block leading-tight">
              Health Check
            </span>
            <span className="text-[11px] text-muted-foreground">
              Copertura: {coveragePercent}% · Equità: {equityLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasSickness && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-1">
              <Stethoscope className="h-2.5 w-2.5" />
              Malattia
            </Badge>
          )}
          {GROUP_CONFIG.map(g => {
            const count = grouped[g.key].length;
            if (count === 0) return null;
            return (
              <span key={g.key} className="flex items-center gap-1">
                <span className={cn("w-2 h-2 rounded-full", g.dot)} />
                <span className="text-[11px] text-muted-foreground font-medium">{count}</span>
              </span>
            );
          })}
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Coverage progress bar */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Stato Copertura</span>
            <span className={cn(
              "text-[11px] font-bold",
              coveragePercent === 100 ? "text-emerald-600 dark:text-emerald-400" :
              coveragePercent >= 80 ? "text-amber-600 dark:text-amber-400" : "text-destructive"
            )}>
              {coveragePercent}%
            </span>
          </div>
          <Progress
            value={coveragePercent}
            className="h-1.5"
          />
        </div>
      )}

      {/* Apply All */}
      {!collapsed && actionableCount > 1 && (
        <div className="px-4 pt-2 pb-1 flex justify-end">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-[11px] px-3 gap-1.5"
            onClick={onApplyAll}
          >
            <Zap className="h-3 w-3" />
            Applica Tutte ({actionableCount})
          </Button>
        </div>
      )}

      {/* Grouped Suggestions */}
      {!collapsed && (
        <ScrollArea className="max-h-[400px]">
          <div className="px-4 pt-2 pb-3 space-y-3">
            {GROUP_CONFIG.map(groupCfg => {
              const items = grouped[groupCfg.key];
              if (items.length === 0) return null;
              const GroupIcon = groupCfg.icon;
              const isGroupCollapsed = collapsedGroups.has(groupCfg.key);

              return (
                <div key={groupCfg.key} className="rounded-lg border border-border/40 overflow-hidden">
                  {/* Group header */}
                  <button
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 transition-colors",
                      groupCfg.bgHeader
                    )}
                    onClick={() => toggleGroup(groupCfg.key)}
                  >
                    <div className="flex items-center gap-2">
                      <GroupIcon className={cn("h-3.5 w-3.5", groupCfg.color)} />
                      <span className={cn("text-xs font-semibold", groupCfg.color)}>
                        {groupCfg.label}
                      </span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5">
                        {items.length}
                      </Badge>
                    </div>
                    {isGroupCollapsed
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </button>

                  {/* Group items */}
                  {!isGroupCollapsed && (
                    <div className="p-2 space-y-1.5">
                      {items.map(suggestion => {
                        const sickness = isSicknessRelated(suggestion);
                        const action = getContextualAction(suggestion);
                        const ActionIcon = action.icon;

                        return (
                          <div
                            key={suggestion.id}
                            className={cn(
                              "rounded-lg border p-3 transition-all",
                              sickness
                                ? "bg-rose-50/80 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/40"
                                : groupCfg.bgCard
                            )}
                          >
                            <div className="flex items-start gap-2.5">
                              {sickness ? (
                                <Stethoscope className="h-4 w-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                              ) : (
                                <GroupIcon className={cn("h-4 w-4 mt-0.5 shrink-0", groupCfg.color)} />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                  <span className="text-xs font-semibold text-foreground leading-tight">
                                    {humanizeTitle(suggestion)}
                                  </span>
                                  {sickness && (
                                    <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5 gap-0.5">
                                      <Stethoscope className="h-2 w-2" />
                                      Priorità
                                    </Badge>
                                  )}
                                  {suggestion.userName && (
                                    <span className="text-[10px] text-muted-foreground">
                                      — {suggestion.userName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  {suggestion.description}
                                </p>

                                {/* Contextual action buttons */}
                                <div className="flex items-center gap-1.5 mt-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-6 text-[10px] px-2.5 gap-1"
                                    onClick={() => handleAccept(suggestion)}
                                  >
                                    <ActionIcon className="h-2.5 w-2.5" />
                                    {action.label}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] px-2.5 gap-1 text-muted-foreground"
                                    onClick={() => handleDecline(suggestion.id)}
                                  >
                                    <X className="h-2.5 w-2.5" />
                                    Ignora
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
