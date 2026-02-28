import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateAppointment } from "@/hooks/useAppointments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarIcon, Store, User, Search, Send } from "lucide-react";

const CATEGORIES = [
  { value: "meeting", label: "Riunione" },
  { value: "training", label: "Formazione" },
  { value: "inspection", label: "Ispezione" },
  { value: "event", label: "Evento" },
  { value: "other", label: "Altro" },
];

const ROLE_FILTERS = [
  { value: "all", label: "Tutti" },
  { value: "sala", label: "Sala" },
  { value: "cucina", label: "Cucina" },
  { value: "admin", label: "Admin" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
}

interface EmployeeOption {
  id: string;
  name: string;
  department: string | null;
  role: string | null;
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
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all people for the selected store (with department + role)
  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["store-people-for-appointment", storeId],
    queryFn: async () => {
      // Get store members with profiles and employee_details
      const { data: assignments, error } = await supabase
        .from("user_store_assignments")
        .select("user_id, profiles(id, full_name, email)")
        .eq("store_id", storeId);
      if (error) throw error;

      const userIds = (assignments ?? []).map((a: any) => a.user_id);
      if (userIds.length === 0) return [];

      // Fetch employee_details for departments
      const { data: details } = await supabase
        .from("employee_details")
        .select("user_id, department")
        .in("user_id", userIds);

      // Fetch roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const detailsMap = new Map((details ?? []).map((d) => [d.user_id, d.department]));
      const rolesMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

      return (assignments ?? []).map((a: any) => ({
        id: a.profiles.id,
        name: a.profiles.full_name || a.profiles.email || "Senza nome",
        department: detailsMap.get(a.user_id) ?? null,
        role: rolesMap.get(a.user_id) ?? null,
      }));
    },
    enabled: !!storeId,
  });

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (roleFilter === "sala") list = list.filter((e) => e.department === "sala");
    else if (roleFilter === "cucina") list = list.filter((e) => e.department === "cucina");
    else if (roleFilter === "admin") list = list.filter((e) => e.role === "admin" || e.role === "super_admin");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [employees, roleFilter, searchQuery]);

  const reset = () => {
    setTitle(""); setDescription(""); setCategory("meeting"); setNotes("");
    setDate(defaultDate ?? new Date().toISOString().slice(0, 10));
    setStartTime("09:00"); setEndTime("10:00");
    setTargetUserId(""); setRoleFilter("all"); setSearchQuery("");
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
      toast.success("Appuntamento inviato!");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Errore nella creazione dell'appuntamento");
    }
  };

  const selectedPerson = employees.find((e) => e.id === targetUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide">
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
              <Select value={storeId} onValueChange={(v) => { setStoreId(v); setTargetUserId(""); }}>
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

          {/* Person selector with filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Invita persona (opzionale)</Label>

            {/* Role filter chips */}
            <div className="flex gap-1.5 flex-wrap">
              {ROLE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setRoleFilter(f.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    roleFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Cerca per nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Person list */}
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-secondary/50 scrollbar-hide">
              <button
                type="button"
                onClick={() => setTargetUserId("none")}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  !targetUserId || targetUserId === "none" ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                Nessuno
              </button>
              {filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setTargetUserId(emp.id)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                    targetUserId === emp.id ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-accent"
                  }`}
                >
                  <span>{emp.name}</span>
                  <span className="flex gap-1">
                    {emp.department && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                        {emp.department === "sala" ? "Sala" : "Cucina"}
                      </Badge>
                    )}
                    {(emp.role === "admin" || emp.role === "super_admin") && (
                      <Badge className="text-[9px] px-1 py-0 h-4 bg-primary/15 text-primary border-0">
                        {emp.role === "super_admin" ? "S.Admin" : "Admin"}
                      </Badge>
                    )}
                  </span>
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Nessun risultato</p>
              )}
            </div>

            {selectedPerson && targetUserId !== "none" && (
              <p className="text-xs text-primary font-medium">
                Selezionato: {selectedPerson.name}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apt-desc">Descrizione</Label>
            <Textarea id="apt-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrivi l'appuntamento..." rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apt-notes">Note</Label>
            <Textarea id="apt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note aggiuntive..." rows={2} />
          </div>

          {/* Submit button - always visible */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button type="submit" disabled={createAppointment.isPending} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {createAppointment.isPending ? "Invio..." : "Invia appuntamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
