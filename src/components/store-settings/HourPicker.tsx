import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0–24

interface Props {
  value: string;          // "HH:00" format
  onChange: (v: string) => void;
  disabled?: boolean;
  label?: string;
}

function hourToDisplay(hour: number): string {
  return String(hour).padStart(2, "0");
}

function parseHour(value: string): number {
  const h = parseInt(value.split(":")[0], 10);
  return isNaN(h) ? 0 : h;
}

export default function HourPicker({ value, onChange, disabled, label }: Props) {
  const [open, setOpen] = useState(false);
  const current = parseHour(value);

  const select = (h: number) => {
    onChange(`${hourToDisplay(h)}:00`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium",
            "hover:bg-accent/50 transition-colors cursor-pointer select-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            disabled && "opacity-50 pointer-events-none"
          )}
        >
          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span>{hourToDisplay(current)}:00</span>
          {label && <span className="text-muted-foreground text-[10px] ml-0.5">{label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2 backdrop-blur-xl bg-popover/95 border-border/50 shadow-xl"
        align="start"
        sideOffset={6}
      >
        <div className="grid grid-cols-4 gap-1">
          {HOURS.map((h) => (
            <Button
              key={h}
              variant={h === current ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 w-10 text-xs font-mono p-0",
                h === current && "ring-1 ring-primary/30"
              )}
              onClick={() => select(h)}
            >
              {hourToDisplay(h)}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
