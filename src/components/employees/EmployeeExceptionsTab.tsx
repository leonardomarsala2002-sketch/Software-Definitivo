import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeExceptions, useCreateException, useDeleteException } from "@/hooks/useEmployees";

const TYPE_LABELS: Record<string, string> = {
  ferie: "Ferie",
  permesso: "Permesso",
  malattia: "Malattia",
  modifica_orario: "Modifica orario",
  altro: "Altro",
};

const TYPE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ferie: "default",
  permesso: "secondary",
  malattia: "destructive",
  modifica_orario: "outline",
  altro: "outline",
};

interface Props {
  userId: string;
  storeId: string | null;
  canEdit: boolean;
}

export default function EmployeeExceptionsTab({ userId, storeId, canEdit }: Props) {
  const { user } = useAuth();
  const { data: exceptions, isLoading } = useEmployeeExceptions(userId);
  const createExc = useCreateException();
  const deleteExc = useDeleteException();

  const [showForm, setShowForm] = useState(false);
  const [excType, setExcType] = useState<string>("ferie");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleAdd = () => {
    if (!storeId) {
      toast.error("Nessuno store primario assegnato");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Inserisci date di inizio e fine");
      return;
    }
    if (endDate < startDate) {
      toast.error("La data di fine deve essere uguale o successiva alla data di inizio");
      return;
    }
    createExc.mutate(
      {
        user_id: userId,
        store_id: storeId,
        exception_type: excType as any,
        start_date: startDate,
        end_date: endDate,
        notes: notes || null,
        created_by: user?.id ?? null,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setNotes("");
          setStartDate("");
          setEndDate("");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {exceptions && exceptions.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-6">Nessuna eccezione futura</p>
      )}

      {exceptions?.map((exc) => (
        <div key={exc.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={TYPE_COLORS[exc.exception_type] ?? "outline"} className="text-[11px]">
                {TYPE_LABELS[exc.exception_type] ?? exc.exception_type}
              </Badge>
            </div>
            <p className="text-sm text-foreground">
              {new Date(exc.start_date).toLocaleDateString("it-IT")} – {new Date(exc.end_date).toLocaleDateString("it-IT")}
            </p>
            {exc.notes && <p className="text-xs text-muted-foreground">{exc.notes}</p>}
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => deleteExc.mutate({ id: exc.id, userId })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}

      {canEdit && !showForm && (
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Aggiungi eccezione
        </Button>
      )}

      {showForm && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={excType} onValueChange={setExcType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Dal</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Al</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (opzionale)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={createExc.isPending} className="flex-1">
              Salva
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
