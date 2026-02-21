import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Copy, RotateCcw, Zap, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0–24

const TYPICAL_ENTRY = [9, 11, 18];
const TYPICAL_EXIT = [15, 23, 24];

interface AllowedTime {
  department: "sala" | "cucina";
  kind: "entry" | "exit";
  hour: number;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allowedTimes: AllowedTime[];
  onSave: (times: AllowedTime[]) => void;
  isSaving: boolean;
  readOnly: boolean;
}

type TimeSet = Record<string, Set<number>>; // "sala-entry" -> Set(9,11,...)

function buildKey(dept: string, kind: string) {
  return `${dept}-${kind}`;
}

function fromArray(arr: AllowedTime[]): TimeSet {
  const m: TimeSet = {};
  for (const dept of ["sala", "cucina"] as const) {
    for (const kind of ["entry", "exit"] as const) {
      m[buildKey(dept, kind)] = new Set();
    }
  }
  arr.filter(t => t.is_active).forEach(t => {
    m[buildKey(t.department, t.kind)]?.add(t.hour);
  });
  return m;
}

function toArray(m: TimeSet): AllowedTime[] {
  const result: AllowedTime[] = [];
  for (const dept of ["sala", "cucina"] as const) {
    for (const kind of ["entry", "exit"] as const) {
      const set = m[buildKey(dept, kind)] ?? new Set();
      set.forEach(h => {
        result.push({ department: dept, kind, hour: h, is_active: true });
      });
    }
  }
  return result;
}

export default function AllowedTimesModal({ open, onOpenChange, allowedTimes, onSave, isSaving, readOnly }: Props) {
  const [activeDept, setActiveDept] = useState<"sala" | "cucina">("sala");
  const [timeSet, setTimeSet] = useState<TimeSet>({});

  useEffect(() => {
    setTimeSet(fromArray(allowedTimes));
  }, [allowedTimes, open]);

  const toggle = (kind: "entry" | "exit", hour: number) => {
    if (readOnly) return;
    const key = buildKey(activeDept, kind);
    setTimeSet(prev => {
      const next = { ...prev };
      const s = new Set(next[key]);
      if (s.has(hour)) s.delete(hour); else s.add(hour);
      next[key] = s;
      return next;
    });
  };

  const selectTypical = (kind: "entry" | "exit") => {
    const key = buildKey(activeDept, kind);
    const typical = kind === "entry" ? TYPICAL_ENTRY : TYPICAL_EXIT;
    setTimeSet(prev => ({ ...prev, [key]: new Set(typical) }));
  };

  const selectAll = (kind: "entry" | "exit") => {
    const key = buildKey(activeDept, kind);
    setTimeSet(prev => ({ ...prev, [key]: new Set(HOURS) }));
  };

  const reset = (kind: "entry" | "exit") => {
    const key = buildKey(activeDept, kind);
    setTimeSet(prev => ({ ...prev, [key]: new Set() }));
  };

  const copyToOther = () => {
    const other = activeDept === "sala" ? "cucina" : "sala";
    setTimeSet(prev => ({
      ...prev,
      [buildKey(other, "entry")]: new Set(prev[buildKey(activeDept, "entry")]),
      [buildKey(other, "exit")]: new Set(prev[buildKey(activeDept, "exit")]),
    }));
    toast.info(`Copiato da ${activeDept === "sala" ? "Sala" : "Cucina"} a ${other === "sala" ? "Sala" : "Cucina"}`);
  };

  // Validation
  const entrySet = timeSet[buildKey(activeDept, "entry")] ?? new Set();
  const exitSet = timeSet[buildKey(activeDept, "exit")] ?? new Set();
  const entryEmpty = entrySet.size === 0;
  const exitEmpty = exitSet.size === 0;

  const warning = useMemo(() => {
    if (entryEmpty || exitEmpty) return null;
    const minEntry = Math.min(...entrySet);
    const minExit = Math.min(...exitSet);
    if (minExit <= minEntry) return "L'uscita minima è ≤ all'entrata minima";
    return null;
  }, [entrySet, exitSet, entryEmpty, exitEmpty]);

  const canSave = !entryEmpty && !exitEmpty;

  const handleSave = () => {
    // Check both departments
    for (const dept of ["sala", "cucina"] as const) {
      const ek = buildKey(dept, "entry");
      const xk = buildKey(dept, "exit");
      if ((timeSet[ek]?.size ?? 0) === 0 && (timeSet[xk]?.size ?? 0) === 0) continue; // skip unconfigured dept
      if ((timeSet[ek]?.size ?? 0) === 0 || (timeSet[xk]?.size ?? 0) === 0) {
        toast.error(`Configura entrate e uscite per ${dept === "sala" ? "Sala" : "Cucina"}`);
        return;
      }
    }
    onSave(toArray(timeSet));
    onOpenChange(false);
  };

  const renderGrid = (kind: "entry" | "exit") => {
    const set = timeSet[buildKey(activeDept, kind)] ?? new Set();
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            {kind === "entry" ? "Entrate consentite" : "Uscite consentite"}
          </span>
          {!readOnly && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => selectTypical(kind)}>
                <Zap className="mr-0.5 h-2.5 w-2.5" /> Tipiche
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => selectAll(kind)}>
                <CheckCheck className="mr-0.5 h-2.5 w-2.5" /> Tutte
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => reset(kind)}>
                <RotateCcw className="mr-0.5 h-2.5 w-2.5" /> Reset
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {HOURS.map((h) => {
            const selected = set.has(h);
            return (
              <button
                key={h}
                type="button"
                disabled={readOnly}
                onClick={() => toggle(kind, h)}
                className={cn(
                  "h-8 rounded-md text-xs font-mono transition-all select-none",
                  "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-primary text-primary-foreground border-primary/50 shadow-sm"
                    : "bg-accent/20 text-muted-foreground border-border/30 hover:bg-accent/40",
                  readOnly && "opacity-60 pointer-events-none"
                )}
              >
                {String(h).padStart(2, "0")}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/95 border-border/50 shadow-2xl sm:max-w-sm max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">Entrate / Uscite consentite</DialogTitle>
          <DialogDescription className="text-xs">
            Ore consentite per inizio e fine turno, per reparto.
          </DialogDescription>
        </DialogHeader>

        {/* Department toggle */}
        <div className="flex gap-1 shrink-0">
          {(["sala", "cucina"] as const).map((dept) => (
            <Button
              key={dept}
              variant={activeDept === dept ? "default" : "outline"}
              size="sm"
              className="text-xs flex-1 h-7"
              onClick={() => setActiveDept(dept)}
            >
              {dept === "sala" ? "Sala" : "Cucina"}
              {(timeSet[buildKey(dept, "entry")]?.size ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">
                  {timeSet[buildKey(dept, "entry")]?.size ?? 0}/{timeSet[buildKey(dept, "exit")]?.size ?? 0}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Grids */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {renderGrid("entry")}
          {renderGrid("exit")}
        </div>

        {/* Warning */}
        {warning && (
          <p className="text-[11px] text-destructive/80 px-1 shrink-0">⚠ {warning}</p>
        )}

        {/* Actions */}
        {!readOnly && (
          <div className="flex justify-between items-center shrink-0 pt-1">
            <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={copyToOther}>
              <Copy className="mr-1 h-3 w-3" /> Copia a {activeDept === "sala" ? "Cucina" : "Sala"}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !canSave} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Salva
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
