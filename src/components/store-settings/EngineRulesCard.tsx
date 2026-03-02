import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Pencil, Trash2, Plus, Save, X } from "lucide-react";
import { useEngineRules, useUpsertEngineRule, useDeleteEngineRule, type EngineRule } from "@/hooks/useEngineRules";
import { Skeleton } from "@/components/ui/skeleton";

const RULE_TYPE_OPTIONS = [
  { label: "Solo testo per Gemini", value: "__null__" },
  { label: "Prestito come prima alternativa", value: "lending_first" },
  { label: "Prestito se nessuna alternativa interna", value: "lending_last_resort" },
  { label: "Aumenta peso memoria storica", value: "memory_weight_boost" },
  { label: "Privilegia spezzati (copertura alta)", value: "strategy_splits_high" },
  { label: "Privilegia turni continui (copertura bassa)", value: "strategy_splits_low" },
] as const;

function getRuleTypeLabel(value: string | null): string {
  const opt = RULE_TYPE_OPTIONS.find(o => (value === null ? o.value === "__null__" : o.value === value));
  return opt?.label ?? "Solo testo per Gemini";
}

export default function EngineRulesCard() {
  const { data: rules = [], isLoading } = useEngineRules();
  const upsert = useUpsertEngineRule();
  const remove = useDeleteEngineRule();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRuleType, setEditRuleType] = useState<string>("__null__");
  const [isNew, setIsNew] = useState(false);

  const startEdit = (rule: EngineRule) => {
    setEditingId(rule.id);
    setEditLabel(rule.label);
    setEditDesc(rule.description);
    setEditRuleType(rule.rule_type ?? "__null__");
    setIsNew(false);
  };

  const startNew = () => {
    setEditingId("__new__");
    setEditLabel("");
    setEditDesc("");
    setEditRuleType("__null__");
    setIsNew(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsNew(false);
  };

  const handleSave = () => {
    if (!editLabel.trim() || !editDesc.trim()) return;
    const maxSort = rules.length > 0 ? Math.max(...rules.map((r) => r.sort_order)) : 0;
    upsert.mutate(
      {
        id: isNew ? undefined : editingId!,
        label: editLabel.trim(),
        description: editDesc.trim(),
        sort_order: isNew ? maxSort + 1 : (rules.find((r) => r.id === editingId)?.sort_order ?? maxSort + 1),
        rule_type: editRuleType === "__null__" ? null : editRuleType,
      },
      { onSuccess: () => cancelEdit() }
    );
  };

  const handleDelete = (id: string) => {
    if (editingId === id) cancelEdit();
    remove.mutate(id);
  };

  const renderForm = () => (
    <div className="space-y-2">
      <Input
        value={editLabel}
        onChange={(e) => setEditLabel(e.target.value)}
        placeholder="Titolo regola"
        className="text-xs h-8"
      />
      <Textarea
        value={editDesc}
        onChange={(e) => setEditDesc(e.target.value)}
        placeholder="Descrizione regola"
        className="text-xs min-h-[60px]"
      />
      <div>
        <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Tipo comportamento</label>
        <Select value={editRuleType} onValueChange={setEditRuleType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RULE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1.5 justify-end">
        <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs">
          <X className="h-3 w-3 mr-1" /> Annulla
        </Button>
        <Button size="sm" onClick={handleSave} disabled={upsert.isPending} className="h-7 text-xs">
          <Save className="h-3 w-3 mr-1" /> Salva
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl mt-6" />;
  }

  return (
    <Card className="mt-6 border-dashed border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Regole Motore (solo preview)</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">DEV</Badge>
        </div>

        <ul className="space-y-2">
          {rules.map((rule) =>
            editingId === rule.id ? (
              <li key={rule.id} className="rounded-lg border border-primary/30 bg-background p-3">
                {renderForm()}
              </li>
            ) : (
              <li key={rule.id} className="text-xs flex items-start gap-2 group">
                <div className="flex-1">
                  <span className="font-medium text-foreground">{rule.label}:</span>{" "}
                  <span className="text-muted-foreground">{rule.description}</span>
                  {rule.rule_type && (
                    <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 align-middle">
                      {getRuleTypeLabel(rule.rule_type)}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(rule)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(rule.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            )
          )}

          {isNew && editingId === "__new__" && (
            <li className="rounded-lg border border-primary/30 bg-background p-3">
              {renderForm()}
            </li>
          )}
        </ul>

        {!isNew && (
          <Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={startNew}>
            <Plus className="h-3 w-3 mr-1" /> Nuova regola
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
