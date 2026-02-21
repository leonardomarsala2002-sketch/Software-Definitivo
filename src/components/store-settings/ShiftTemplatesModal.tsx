import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2 } from "lucide-react";
import type { ShiftTemplate } from "@/hooks/useStoreSettings";
import HourPicker from "./HourPicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: ShiftTemplate[];
  onSave: (templates: { department: "sala" | "cucina"; start_time: string; end_time: string; is_active: boolean }[]) => void;
  isSaving: boolean;
  readOnly: boolean;
}

type LocalTemplate = {
  department: "sala" | "cucina";
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export default function ShiftTemplatesModal({ open, onOpenChange, templates, onSave, isSaving, readOnly }: Props) {
  const [activeDept, setActiveDept] = useState<"sala" | "cucina">("sala");
  const [form, setForm] = useState<LocalTemplate[]>([]);

  useEffect(() => {
    setForm(
      templates.map((t) => ({
        department: t.department as "sala" | "cucina",
        start_time: t.start_time.slice(0, 5),
        end_time: t.end_time.slice(0, 5),
        is_active: t.is_active,
      }))
    );
  }, [templates, open]);

  const filtered = form.filter((t) => t.department === activeDept);

  const add = () => {
    setForm((prev) => [...prev, { department: activeDept, start_time: "09:00", end_time: "14:00", is_active: true }]);
  };

  const remove = (globalIdx: number) => {
    setForm((prev) => prev.filter((_, i) => i !== globalIdx));
  };

  const updateField = (globalIdx: number, field: keyof LocalTemplate, value: any) => {
    setForm((prev) => prev.map((t, i) => (i === globalIdx ? { ...t, [field]: value } : t)));
  };

  const getGlobalIdx = (deptIdx: number) => {
    let count = 0;
    for (let i = 0; i < form.length; i++) {
      if (form[i].department === activeDept) {
        if (count === deptIdx) return i;
        count++;
      }
    }
    return -1;
  };

  const handleSave = () => {
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-card/95 border-border/50 shadow-2xl sm:max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Turni Possibili</DialogTitle>
          <DialogDescription className="text-xs">Template turni per reparto. Opzionale.</DialogDescription>
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
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nessun template per {activeDept}</p>
          ) : (
            filtered.map((t, deptIdx) => {
              const gIdx = getGlobalIdx(deptIdx);
              return (
                <div key={deptIdx} className="flex items-center gap-1.5 rounded-md border border-border/30 bg-accent/10 px-2 py-1.5">
                  <HourPicker
                    value={t.start_time}
                    disabled={readOnly}
                    onChange={(v) => updateField(gIdx, "start_time", v)}
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <HourPicker
                    value={t.end_time}
                    disabled={readOnly}
                    onChange={(v) => updateField(gIdx, "end_time", v)}
                  />
                  <Badge
                    variant={t.is_active ? "default" : "secondary"}
                    className="cursor-pointer text-[10px] px-1.5"
                    onClick={() => !readOnly && updateField(gIdx, "is_active", !t.is_active)}
                  >
                    {t.is_active ? "ON" : "OFF"}
                  </Badge>
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => remove(gIdx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {!readOnly && (
          <div className="flex justify-between shrink-0 pt-1">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={add}>
              <Plus className="mr-1 h-3 w-3" /> Aggiungi
            </Button>
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Salva
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
