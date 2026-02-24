import { useState, useMemo } from "react";
import {
  ChevronDown, ChevronUp, X, Zap, Stethoscope, Shield,
  Scale, Users, Search, Scissors, Heart, ArrowRightLeft,
  Clock, UserPlus, FastForward, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { OptimizationSuggestion, CorrectionAction } from "@/hooks/useOptimizationSuggestions";

interface OptimizationPanelProps {
  suggestions: OptimizationSuggestion[];
  onAccept: (suggestion: OptimizationSuggestion, action?: CorrectionAction) => void;
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
  return "equity";
}

function isSicknessRelated(s: OptimizationSuggestion): boolean {
  const desc = (s.description ?? "").toLowerCase();
  return desc.includes("malattia") || desc.includes("sickness") || desc.includes("emergenz");
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  shift_earlier: FastForward,
  shift_later: Clock,
  add_split: Scissors,
  extend_shift: Clock,
  lending: ArrowRightLeft,
  remove_surplus: X,
  reduce_hours: Scale,
  generic: Check,
};

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
  // Track which alternative index is currently shown for each suggestion
  const [alternativeIndex, setAlternativeIndex] = useState<Record<string, number>>({});

  const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.id));

  const sorted = useMemo(() => {
    return [...visibleSuggestions].sort((a, b) => {
      const groupOrder: Record<GroupKey, number> = { critical: 0, equity: 1, lending: 2 };
      const ga = classifyGroup(a);
      const gb = classifyGroup(b);
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

  const totalSlots = suggestions.length || 1;
  const uncoveredCount = visibleSuggestions.filter(s => s.type === "uncovered").length;
  const coveragePercent = Math.round(((totalSlots - uncoveredCount) / totalSlots) * 100);
  const equityItems = grouped.equity.length;
  const equityLabel = equityItems === 0 ? "Bilanciata" : `${equityItems} da ottimizzare`;
  const actionableCount = visibleSuggestions.filter(s => s.type !== "uncovered").length;
  const hasSickness = visibleSuggestions.some(isSicknessRelated);

  if (visibleSuggestions.length === 0) return null;

  const handleDecline = (suggestion: OptimizationSuggestion) => {
    const alts = suggestion.alternatives ?? [];
    const currentIdx = alternativeIndex[suggestion.id] ?? 0;
    const isCritical = suggestion.type === "uncovered";
    
    if (alts.length > 0 && currentIdx < alts.length - 1) {
      // Show next alternative
      setAlternativeIndex(prev => ({ ...prev, [suggestion.id]: currentIdx + 1 }));
    } else if (isCritical) {
      // Critical (uncovered): cycle back to first alternative — user MUST resolve this
      setAlternativeIndex(prev => ({ ...prev, [suggestion.id]: 0 }));
    } else {
      // Non-critical: dismiss
      setDismissedIds(prev => new Set(prev).add(suggestion.id));
      onDecline(suggestion.id);
    }
  };

  const handleAccept = (suggestion: OptimizationSuggestion) => {
    const alts = suggestion.alternatives ?? [];
    const currentIdx = alternativeIndex[suggestion.id] ?? 0;
    const currentAction = alts.length > 0 ? alts[currentIdx] : undefined;
    
    if (suggestion.type === "uncovered" && suggestion.date && onNavigateToDay && !currentAction) {
      onNavigateToDay(suggestion.date);
    } else {
      onAccept(suggestion, currentAction);
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

  const getCurrentAction = (suggestion: OptimizationSuggestion): { label: string; icon: React.ElementType; description?: string } => {
    const alts = suggestion.alternatives ?? [];
    const idx = alternativeIndex[suggestion.id] ?? 0;
    
    if (alts.length > 0 && idx < alts.length) {
      const alt = alts[idx];
      return {
        label: alt.label,
        icon: ACTION_ICONS[alt.actionType] ?? Check,
        description: alt.description,
      };
    }
    
    // Fallback
    if (suggestion.type === "uncovered") return { label: "Vai al giorno", icon: Search };
    if (suggestion.type === "surplus") return { label: "Rimuovi Surplus", icon: X };
    if (suggestion.type === "lending") return { label: "Accetta Prestito", icon: ArrowRightLeft };
    if (suggestion.type === "hour_reduction") return { label: "Riduci Ore", icon: Scale };
    return { label: suggestion.actionLabel, icon: Check };
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
            <span className="text-sm font-semibold text-foreground block leading-tight">Health Check</span>
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

      {!collapsed && (
        <>
          {/* Coverage bar */}
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
            <Progress value={coveragePercent} className="h-1.5" />
          </div>

          {actionableCount > 1 && (
            <div className="px-4 pt-2 pb-1 flex justify-end">
              <Button size="sm" variant="default" className="h-7 text-[11px] px-3 gap-1.5" onClick={onApplyAll}>
                <Zap className="h-3 w-3" />
                Applica Tutte ({actionableCount})
              </Button>
            </div>
          )}

          <ScrollArea className="max-h-[400px]">
            <div className="px-4 pt-2 pb-3 space-y-3">
              {GROUP_CONFIG.map(groupCfg => {
                const items = grouped[groupCfg.key];
                if (items.length === 0) return null;
                const GroupIcon = groupCfg.icon;
                const isGroupCollapsed = collapsedGroups.has(groupCfg.key);

                return (
                  <div key={groupCfg.key} className="rounded-lg border border-border/40 overflow-hidden">
                    <button
                      className={cn("w-full flex items-center justify-between px-3 py-2 transition-colors", groupCfg.bgHeader)}
                      onClick={() => toggleGroup(groupCfg.key)}
                    >
                      <div className="flex items-center gap-2">
                        <GroupIcon className={cn("h-3.5 w-3.5", groupCfg.color)} />
                        <span className={cn("text-xs font-semibold", groupCfg.color)}>{groupCfg.label}</span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5">{items.length}</Badge>
                      </div>
                      {isGroupCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>

                    {!isGroupCollapsed && (
                      <div className="p-2 space-y-1.5">
                        {items.map(suggestion => {
                          const sickness = isSicknessRelated(suggestion);
                          const action = getCurrentAction(suggestion);
                          const ActionIcon = action.icon;
                          const alts = suggestion.alternatives ?? [];
                          const currentIdx = alternativeIndex[suggestion.id] ?? 0;
                          const hasMoreAlts = alts.length > 0 && currentIdx < alts.length - 1;
                          const isOnLastAlt = alts.length > 0 && currentIdx === alts.length - 1;
                          let declineLabel: string;
                          if (suggestion.type === "uncovered") {
                            declineLabel = isOnLastAlt ? "Riparti da capo" : "Altra soluzione";
                          } else {
                            declineLabel = hasMoreAlts ? "Altra soluzione" : "Ignora";
                          }

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
                                  {/* Title row */}
                                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                    <span className="text-xs font-semibold text-foreground leading-tight">
                                      {suggestion.title}
                                    </span>
                                    {sickness && (
                                      <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5 gap-0.5">
                                        <Stethoscope className="h-2 w-2" />
                                        Priorità
                                      </Badge>
                                    )}
                                  </div>

                                  {/* Description */}
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    {suggestion.description}
                                  </p>

                                  {/* Surplus info */}
                                  {suggestion.surplusCount !== undefined && suggestion.surplusCount > 0 && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                                      👥 {suggestion.surplusCount} persona/e in più{suggestion.surplusReason ? ` — ${suggestion.surplusReason}` : ""}
                                    </p>
                                  )}

                                  {/* Current alternative action */}
                                  {action.description && (
                                    <div className="mt-1.5 px-2 py-1.5 rounded-md bg-background/80 border border-border/40">
                                      <p className="text-[11px] text-foreground font-medium leading-snug">
                                        💡 {action.description}
                                      </p>
                                    </div>
                                  )}

                                  {/* Alternative counter */}
                                  {alts.length > 1 && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Soluzione {currentIdx + 1} di {alts.length}
                                    </p>
                                  )}

                                  {/* Action buttons */}
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
                                      onClick={() => handleDecline(suggestion)}
                                    >
                                      <X className="h-2.5 w-2.5" />
                                      {declineLabel}
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
        </>
      )}
    </div>
  );
}
