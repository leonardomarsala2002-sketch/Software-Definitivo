import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, Check, X, ChevronRight, Stethoscope,
  Shield, Scale, Users, Scissors, Clock, ArrowRightLeft,
  FastForward, Search, CalendarPlus, Lightbulb, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OptimizationSuggestion, CorrectionAction } from "@/hooks/useOptimizationSuggestions";

interface SuggestionWizardDialogProps {
  open: boolean;
  suggestions: OptimizationSuggestion[];
  onAccept: (suggestion: OptimizationSuggestion, action?: CorrectionAction) => void;
  onDecline: (suggestionId: string) => void;
  onClose: () => void;
  onNavigateToDay?: (date: string) => void;
}

type GroupKey = "critical" | "equity" | "lending";

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
  increase_splits: Scissors,
  increase_days_off: CalendarPlus,
  generic: Check,
};

const GROUP_LABELS: Record<GroupKey, { label: string; icon: React.ElementType; color: string }> = {
  critical: { label: "Problema Critico", icon: Shield, color: "text-destructive" },
  equity: { label: "Ottimizzazione", icon: Scale, color: "text-amber-600" },
  lending: { label: "Prestito Inter-Store", icon: Users, color: "text-blue-600" },
};

function getHumanExplanation(s: OptimizationSuggestion): string {
  if (s.type === "uncovered") {
    return `Il giorno ${s.date ? new Date(s.date + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }) : ""} non ci sono abbastanza dipendenti per coprire ${s.slot ? `lo slot delle ${s.slot}` : "tutti gli slot necessari"}. Senza intervento, il servizio potrebbe essere compromesso.`;
  }
  if (s.type === "surplus") {
    return `C'è un eccesso di personale programmato. ${s.surplusCount ? `${s.surplusCount} persona/e in più del necessario` : ""}. Ridurre il surplus migliora l'efficienza e bilancia le ore tra i colleghi.`;
  }
  if (s.type === "lending") {
    return `Un dipendente di un altro store potrebbe coprire un turno scoperto qui. Questo è un prestito inter-store che richiede approvazione bilaterale.`;
  }
  if (s.type === "overtime_balance") {
    return `${s.userName ?? "Un dipendente"} ha accumulato ore in eccesso o in difetto rispetto al contratto. Il sistema propone di compensare nella prossima settimana.`;
  }
  if (s.type === "hour_reduction") {
    return `È possibile ridurre le ore di ${s.userName ?? "un dipendente"} per avvicinarsi al target contrattuale e migliorare l'equità del team.`;
  }
  return s.description;
}

function getFinalRecommendations(suggestions: OptimizationSuggestion[]): string[] {
  const tips: string[] = [];
  const uncoveredCount = suggestions.filter(s => s.type === "uncovered").length;
  const surplusCount = suggestions.filter(s => s.type === "surplus").length;
  const lendingCount = suggestions.filter(s => s.type === "lending").length;
  const overtimeCount = suggestions.filter(s => s.type === "overtime_balance").length;

  if (uncoveredCount > 0) {
    tips.push(`Questa settimana ci sono stati ${uncoveredCount} slot non coperti. Per la prossima settimana, valuta di aggiungere disponibilità ai dipendenti nelle fasce orarie critiche oppure di rivedere i requisiti di copertura nello Store Settings.`);
  }
  if (surplusCount > 0) {
    tips.push(`Sono stati rilevati ${surplusCount} surplus di personale. Verifica che le ore contrattuali dei dipendenti siano aggiornate e che i giorni liberi siano distribuiti equamente.`);
  }
  if (lendingCount > 0) {
    tips.push(`${lendingCount} prestiti inter-store sono stati suggeriti. Se questo accade spesso, valuta di assumere personale aggiuntivo per lo store o di redistribuire le risorse tra gli store.`);
  }
  if (overtimeCount > 0) {
    tips.push(`Ci sono squilibri nel monte ore di alcuni dipendenti. L'algoritmo compenserà automaticamente la prossima settimana, ma verifica che le ore contrattuali settimanali siano corrette per ciascun dipendente.`);
  }
  if (tips.length === 0) {
    tips.push("Nessun problema rilevante questa settimana. Continua a monitorare la copertura e l'equità del team.");
  }
  return tips;
}

export function SuggestionWizardDialog({
  open,
  suggestions,
  onAccept,
  onDecline,
  onClose,
  onNavigateToDay,
}: SuggestionWizardDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [alternativeIndex, setAlternativeIndex] = useState<Record<string, number>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);

  // Sort: critical first, sickness priority
  const sorted = useMemo(() => {
    return [...suggestions].sort((a, b) => {
      const groupOrder: Record<GroupKey, number> = { critical: 0, equity: 1, lending: 2 };
      const ga = classifyGroup(a);
      const gb = classifyGroup(b);
      if (groupOrder[ga] !== groupOrder[gb]) return groupOrder[ga] - groupOrder[gb];
      const sa = isSicknessRelated(a) ? 0 : 1;
      const sb = isSicknessRelated(b) ? 0 : 1;
      return sa - sb;
    });
  }, [suggestions]);

  const total = sorted.length;
  const current = sorted[currentIndex];
  const progress = total > 0 ? Math.round(((currentIndex) / total) * 100) : 0;

  const handleAccept = () => {
    if (!current) return;
    const alts = current.alternatives ?? [];
    const idx = alternativeIndex[current.id] ?? 0;
    const action = alts.length > 0 ? alts[idx] : undefined;

    if (current.type === "uncovered" && current.date && onNavigateToDay && !action) {
      onNavigateToDay(current.date);
    } else {
      onAccept(current, action);
    }

    setResolved(prev => new Set(prev).add(current.id));
    advanceToNext();
  };

  const handleDecline = () => {
    if (!current) return;
    const alts = current.alternatives ?? [];
    const idx = alternativeIndex[current.id] ?? 0;
    const isCritical = current.type === "uncovered";

    if (alts.length > 0 && idx < alts.length - 1) {
      // Show next alternative
      setAlternativeIndex(prev => ({ ...prev, [current.id]: idx + 1 }));
      return;
    }

    if (isCritical) {
      // Reset alternatives for critical - must resolve
      setAlternativeIndex(prev => ({ ...prev, [current.id]: 0 }));
      return;
    }

    // Non-critical: skip
    onDecline(current.id);
    setResolved(prev => new Set(prev).add(current.id));
    advanceToNext();
  };

  const advanceToNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowSummary(true);
    }
  };

  const handleClose = () => {
    setCurrentIndex(0);
    setAlternativeIndex({});
    setResolved(new Set());
    setShowSummary(false);
    onClose();
  };

  if (!open || total === 0) return null;

  // ── Summary screen ──
  if (showSummary) {
    const recommendations = getFinalRecommendations(sorted);
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent
          className="rounded-[24px] max-w-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <CheckCircle2 className="h-5 w-5 text-[#00C853]" />
              Revisione Completata
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Hai rivisto tutti i {total} problemi. Ecco un riepilogo e suggerimenti per la prossima settimana.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Check className="h-4 w-4 text-[#00C853]" />
                <span className="font-medium">{resolved.size} risolti</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <X className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{total - resolved.size} ignorati</span>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Come evitare questi problemi la prossima settimana
              </div>
              {recommendations.map((tip, i) => (
                <div key={i} className="rounded-xl glass-card p-3">
                  <p className="text-xs text-foreground leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleClose} className="gap-2 rounded-xl">
              <Check className="h-4 w-4" />
              Chiudi e Procedi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Single suggestion screen ──
  const group = classifyGroup(current);
  const groupInfo = GROUP_LABELS[group];
  const GroupIcon = groupInfo.icon;
  const sickness = isSicknessRelated(current);
  const alts = current.alternatives ?? [];
  const altIdx = alternativeIndex[current.id] ?? 0;
  const currentAction = alts.length > 0 ? alts[altIdx] : undefined;
  const ActionIcon = currentAction ? (ACTION_ICONS[currentAction.actionType] ?? Check) : Check;
  const hasMoreAlts = alts.length > 0 && altIdx < alts.length - 1;
  const isCritical = current.type === "uncovered";

  let declineLabel: string;
  if (isCritical) {
    declineLabel = hasMoreAlts ? "Altra soluzione" : "Riparti da capo";
  } else {
    declineLabel = hasMoreAlts ? "Altra soluzione" : "Salta";
  }

  const explanation = getHumanExplanation(current);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) return; }}>
      <DialogContent
        className="rounded-[24px] max-w-lg [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Progress */}
        <div className="space-y-1.5 mb-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Problema {currentIndex + 1} di {total}</span>
            <span>{Math.round(((currentIndex + 1) / total) * 100)}%</span>
          </div>
          <Progress value={((currentIndex + 1) / total) * 100} className="h-1.5" />
        </div>

        {/* Category badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn("text-[10px] gap-1", groupInfo.color)}
          >
            <GroupIcon className="h-3 w-3" />
            {groupInfo.label}
          </Badge>
          {sickness && (
            <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0">
              <Stethoscope className="h-3 w-3" />
              Priorità Malattia
            </Badge>
          )}
          {isCritical && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Risoluzione Obbligatoria
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-foreground mt-1 leading-tight">
          {current.title}
        </h3>

        {/* Human explanation */}
        <div className="rounded-xl glass-card p-4 mt-1">
          <p className="text-sm text-foreground leading-relaxed">
            {explanation}
          </p>
          {current.surplusCount !== undefined && current.surplusCount > 0 && (
            <p className="text-xs text-amber-600 mt-2 font-medium">
              👥 {current.surplusCount} persona/e in più{current.surplusReason ? ` — ${current.surplusReason}` : ""}
            </p>
          )}
        </div>

        {/* Proposed solution */}
        {currentAction && (
          <div className="rounded-xl border-2 border-[#00C853]/30 bg-[#00C853]/5 p-4 mt-2">
            <div className="flex items-center gap-2 mb-1.5">
              <ActionIcon className="h-4 w-4 text-[#00C853]" />
              <span className="text-sm font-semibold text-foreground">Soluzione Proposta</span>
              {alts.length > 1 && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {altIdx + 1} di {alts.length}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground">{currentAction.label}</p>
            {currentAction.description && (
              <p className="text-xs text-muted-foreground mt-1">{currentAction.description}</p>
            )}
          </div>
        )}

        {!currentAction && current.type === "uncovered" && (
          <div className="rounded-xl border-2 border-amber-300/50 bg-amber-50/50 p-4 mt-2">
            <div className="flex items-center gap-2 mb-1.5">
              <Search className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-foreground">Azione Suggerita</span>
            </div>
            <p className="text-sm text-foreground">
              Vai al giorno nel calendario per assegnare manualmente un turno.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 mt-4">
          <Button
            variant="ghost"
            className="flex-1 gap-2 text-muted-foreground rounded-xl"
            onClick={handleDecline}
          >
            <X className="h-4 w-4" />
            {declineLabel}
          </Button>
          <Button
            className="flex-1 gap-2 rounded-xl bg-[#00C853] hover:bg-[#00C853]/90 text-white"
            onClick={handleAccept}
          >
            <Check className="h-4 w-4" />
            {currentAction ? "Accetta" : "Vai al giorno"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
