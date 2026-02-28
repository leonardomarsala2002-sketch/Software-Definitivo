import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateAppointment } from "@/hooks/useAppointments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarIcon, Clock, Store, User } from "lucide-react";

const CATEGORIES = [
  { value: "meeting", label: "Riunione" },
  { value: "training", label: "Formazione" },
  { value: "inspection", label: "Ispezione" },
  { value: "event", label: "Evento" },
  { value: "other", label: "Altro" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
}

export function AppointmentFormDialog({ open, onOpenChange, defaultDate }: Props) {
  const { stores, activeStore, role } = useAuth();
  const createAppointment = useCreateAppointment();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("meeting");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [storeId, setStoreId] = useState(activeStore?.id ?? "");
  const [targetUserId, setTargetUserId] = useState("");

  // Fetch employees for the selected store
  const { data: employees = [] } = useQuery({
    queryKey: ["store-employees-for-appointment", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_store_assignments")
        .select("user_id, profiles(id, full_name, email)")
        .eq("store_id", storeId);
      if (error) throw error;
      return (data ?? []).map((a: any) => ({
        id: a.profiles.id,
        name: a.profiles.full_name || a.profiles.email || "Senza nome",
      }));
    },
    enabled: !!storeId,
  });

  const reset = () => {
    setTitle(""); setDescription(""); setCategory("meeting"); setNotes("");
    setDate(defaultDate ?? new Date().toISOString().slice(0, 10));
    setStartTime("09:00"); setEndTime("10:00");
    setTargetUserId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !storeId) {
      toast.error("Compila titolo e seleziona uno store");
      return;
    }
    try {
      await createAppointment.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        notes: notes.trim() || undefined,
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        store_id: storeId,
        target_user_id: targetUserId && targetUserId !== "none" ? targetUserId : undefined,
      });
      toast.success("Appuntamento creato!");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Errore nella creazione dell'appuntamento");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Nuovo appuntamento
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Crea un appuntamento e, se vuoi, invita un collaboratore.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apt-title">Titolo *</Label>
            <Input id="apt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Riunione settimanale" />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="apt-date">Data *</Label>
              <Input id="apt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-start">Inizio</Label>
              <Input id="apt-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-end">Fine</Label>
              <Input id="apt-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> Store</Label>
            {role === "super_admin" ? (
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Seleziona store" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={activeStore?.name ?? ""} disabled className="bg-secondary" />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Invita persona (opzionale)</Label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuno</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apt-desc">Descrizione</Label>
            <Textarea id="apt-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrivi l'appuntamento..." rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apt-notes">Note</Label>
            <Textarea id="apt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note aggiuntive..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button type="submit" disabled={createAppointment.isPending}>
              {createAppointment.isPending ? "Creazione..." : "Crea appuntamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
