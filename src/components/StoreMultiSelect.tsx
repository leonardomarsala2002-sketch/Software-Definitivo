import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Store, ChevronDown } from "lucide-react";

interface StoreOption {
  id: string;
  name: string;
}

interface StoreMultiSelectProps {
  stores: StoreOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function StoreMultiSelect({ stores, selectedIds, onChange }: StoreMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const allSelected = selectedIds.length === stores.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : stores.map((s) => s.id));
  };

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id]
    );
  };

  const label =
    selectedIds.length === 0
      ? "Nessuno store"
      : allSelected
        ? "Tutti gli store"
        : selectedIds.length === 1
          ? stores.find((s) => s.id === selectedIds[0])?.name ?? "1 store"
          : `${selectedIds.length} store`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl border-border/60 bg-background px-3 text-[13px] font-medium shadow-sm"
        >
          <Store className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[140px] truncate">{label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold hover:bg-accent">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
            />
            Tutti gli store
          </label>
          <div className="my-1 h-px bg-border/60" />
          {stores.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-accent"
            >
              <Checkbox
                checked={selectedIds.includes(s.id)}
                onCheckedChange={() => toggle(s.id)}
              />
              {s.name}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
