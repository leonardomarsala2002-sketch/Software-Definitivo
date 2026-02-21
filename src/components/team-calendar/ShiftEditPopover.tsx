import { useState } from "react";
import { Plus, Edit2, Moon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ShiftEditPopoverProps {
  mode: "create" | "edit";
  initialStart?: number;
  initialEnd?: number;
  initialDayOff?: boolean;
  allowedEntries: number[];
  allowedExits: number[];
  onSave: (start: number, end: number, isDayOff: boolean) => void;
}

export function ShiftEditPopover({
  mode,
  initialStart,
  initialEnd,
  initialDayOff = false,
  allowedEntries,
  allowedExits,
  onSave,
}: ShiftEditPopoverProps) {
  const [open, setOpen] = useState(false);
  const [isDayOff, setIsDayOff] = useState(initialDayOff);
  const [start, setStart] = useState<number | null>(initialStart ?? null);
  const [end, setEnd] = useState<number | null>(initialEnd ?? null);

  const entries = allowedEntries.length > 0 ? allowedEntries : Array.from({ length: 24 }, (_, i) => i);
  const exits = allowedExits.length > 0 ? allowedExits : Array.from({ length: 24 }, (_, i) => i + 1);

  const canSave = isDayOff || (start !== null && end !== null && (end > start || end === 0 || end === 24));

  function handleSave() {
    if (!canSave) return;
    onSave(start ?? 0, end ?? 0, isDayOff);
    setOpen(false);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setIsDayOff(initialDayOff);
      setStart(initialStart ?? null);
      setEnd(initialEnd ?? null);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          {mode === "create" ? (
            <Plus className="h-3 w-3 text-primary" />
          ) : (
            <Edit2 className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          {/* Day off toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5">
              <Moon className="h-3 w-3" /> Giorno di riposo
            </Label>
            <Switch checked={isDayOff} onCheckedChange={setIsDayOff} />
          </div>

          {!isDayOff && (
            <>
              {/* Entry hours */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Entrata
                </p>
                <div className="flex flex-wrap gap-1">
                  {entries.map((h) => (
                    <button
                      key={h}
                      className={cn(
                        "w-8 h-7 text-[11px] font-medium rounded border transition-colors",
                        start === h
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:bg-accent"
                      )}
                      onClick={() => setStart(h)}
                    >
                      {String(h).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exit hours */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Uscita
                </p>
                <div className="flex flex-wrap gap-1">
                  {exits.map((h) => (
                    <button
                      key={h}
                      className={cn(
                        "w-8 h-7 text-[11px] font-medium rounded border transition-colors",
                        end === h
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:bg-accent"
                      )}
                      onClick={() => setEnd(h)}
                    >
                      {String(h === 24 ? 0 : h).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button
            className="w-full h-8 text-xs"
            disabled={!canSave}
            onClick={handleSave}
          >
            {mode === "create" ? "Aggiungi" : "Salva"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
