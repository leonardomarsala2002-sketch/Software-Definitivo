import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeExceptions, useCreateException, useDeleteException } from "@/hooks/useEmployees";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { startOfWeek, format, addDays } from "date-fns";

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
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { data: exceptions, isLoading } = useEmployeeExceptions(userId);
  const createExc = useCreateException();
  const deleteExc = useDeleteException();

  const isOwnProfile = user?.id === userId;
  const isEmployee = role === "employee";

  const [showForm, setShowForm] = useState(false);
  const [excType, setExcType] = useState<string>("ferie");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [regenerating, setRegenerating] = useState(false);

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
        onSuccess: async () => {
          setShowForm(false);
          setNotes("");
          setStartDate("");
          setEndDate("");

          // Auto-trigger regeneration for sickness or permesso
          if ((excType === "malattia" || excType === "permesso") && storeId && (role === "admin" || role === "super_admin")) {
            await triggerPatchRegeneration(storeId, startDate, endDate, userId);
          }
        },
      }
    );
  };

  const triggerPatchRegeneration = async (storeId: string, start: string, end: string, affectedUserId: string) => {
    setRegenerating(true);
    try {
      // Find weeks that overlap with the sickness period
      const sickStart = new Date(start);
      const sickEnd = new Date(end);
      const weeksToRegenerate = new Set<string>();

      let d = new Date(sickStart);
      while (d <= sickEnd) {
        const weekMon = startOfWeek(d, { weekStartsOn: 1 });
        weeksToRegenerate.add(format(weekMon, "yyyy-MM-dd"));
        d = addDays(d, 7);
      }

      for (const weekStart of weeksToRegenerate) {
        const { error } = await supabase.functions.invoke("generate-optimized-schedule", {
          body: {
            store_id: storeId,
            week_start_date: weekStart,
            mode: "patch",
            affected_user_id: affectedUserId,
            exception_start_date: start,
            exception_end_date: end,
          },
        });
        if (error) {
          console.error("Patch regeneration error:", error);
          toast.error(`Errore rigenerazione settimana ${weekStart}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["generation-runs"] });
      queryClient.invalidateQueries({ queryKey: ["generation-run-suggestions"] });
      toast.success("Turni rigenerati automaticamente per coprire l'assenza");
    } catch (err) {
      console.error("Patch regeneration failed:", err);
      toast.error("Errore nella rigenerazione automatica dei turni");
    } finally {
      setRegenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Regeneration in progress */}
      {regenerating && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <p className="text-xs text-primary font-medium">Rigenerazione turni in corso per coprire l'assenza...</p>
        </div>
      )}

      {/* Employee hint: use Richieste */}
      {isEmployee && isOwnProfile && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Per richiedere ferie, permessi o modifiche orario, usa la sezione <strong>Richieste</strong> nel menu principale.
          </p>
        </div>
      )}

      {exceptions && exceptions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Nessuna eccezione futura</p>
      )}

      {exceptions?.map((exc) => (
        <div key={exc.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Badge variant={TYPE_COLORS[exc.exception_type] ?? "outline"} className="text-[11px]">
              {TYPE_LABELS[exc.exception_type] ?? exc.exception_type}
            </Badge>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
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
          {(excType === "malattia" || excType === "permesso") && (role === "admin" || role === "super_admin") && (
            <div className="rounded-md border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-2">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                💡 I turni del dipendente verranno automaticamente rigenerati per coprire l'assenza. Riceverai una email con la proposta.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={createExc.isPending || regenerating} className="flex-1">
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Salva
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Annulla</Button>
          </div>
        </div>
      )}
    </div>
  );
}
