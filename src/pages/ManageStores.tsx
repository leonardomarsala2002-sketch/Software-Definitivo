import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Store, Plus, Pencil, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";

interface StoreRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  is_active: boolean;
}

const ManageStores = () => {
  const { realRole } = useAuth();
  const queryClient = useQueryClient();
  const [editingStore, setEditingStore] = useState<StoreRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");

  const canManage = realRole === "super_admin" || realRole === "admin";

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["all-stores-manage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as StoreRow[];
    },
    enabled: canManage,
  });

  const createStore = useMutation({
    mutationFn: async (store: { name: string; address: string | null; city: string | null }) => {
      const { error } = await supabase.from("stores").insert(store);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-stores-manage"] });
      toast.success("Store creato con successo");
      closeDialog();
    },
    onError: (e) => toast.error("Errore: " + e.message),
  });

  const updateStore = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name: string; address: string | null; city: string | null }) => {
      const { error } = await supabase.from("stores").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-stores-manage"] });
      toast.success("Store aggiornato");
      closeDialog();
    },
    onError: (e) => toast.error("Errore: " + e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("stores").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-stores-manage"] });
      toast.success("Stato aggiornato");
    },
  });

  const openCreate = () => {
    setFormName("");
    setFormAddress("");
    setFormCity("");
    setIsCreating(true);
    setEditingStore(null);
  };

  const openEdit = (store: StoreRow) => {
    setFormName(store.name);
    setFormAddress(store.address ?? "");
    setFormCity(store.city ?? "");
    setEditingStore(store);
    setIsCreating(false);
  };

  const closeDialog = () => {
    setEditingStore(null);
    setIsCreating(false);
    setFormName("");
    setFormAddress("");
    setFormCity("");
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error("Il nome dello store è obbligatorio");
      return;
    }
    const payload = {
      name: formName.trim(),
      address: formAddress.trim() || null,
      city: formCity.trim() || null,
    };
    if (editingStore) {
      updateStore.mutate({ id: editingStore.id, ...payload });
    } else {
      createStore.mutate(payload);
    }
  };

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Gestione Store" subtitle="Non hai i permessi per accedere a questa pagina." />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto scrollbar-hide">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <PageHeader title="Gestione Store" subtitle={`${stores.length} store configurati`} />
        {realRole === "super_admin" && (
          <Button onClick={openCreate} className="gap-2 rounded-[14px]">
            <Plus className="h-4 w-4" />
            Nuovo Store
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-muted-foreground text-sm">Caricamento…</p>
        </div>
      ) : stores.length === 0 ? (
        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title="Nessuno store"
          description="Crea il primo store per iniziare."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => (
            <Card key={store.id} className="relative">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00C853]/10">
                      <Building2 className="h-5 w-5 text-[#00C853]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#111]">{store.name}</h3>
                      {store.city && (
                        <p className="text-xs text-[#444] flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {store.city}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={`text-[10px] ${
                      store.is_active
                        ? "bg-[rgba(0,200,83,0.14)] text-[#009624] border border-[rgba(0,200,83,0.35)]"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    {store.is_active ? "Attivo" : "Disattivato"}
                  </Badge>
                </div>

                {store.address && (
                  <p className="text-xs text-[#666] mb-3">{store.address}</p>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(store)}
                    className="gap-1.5 rounded-[10px] text-xs"
                  >
                    <Pencil className="h-3 w-3" />
                    Modifica
                  </Button>
                  {realRole === "super_admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive.mutate({ id: store.id, is_active: !store.is_active })}
                      className="text-xs rounded-[10px]"
                    >
                      {store.is_active ? "Disattiva" : "Riattiva"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating || !!editingStore} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="rounded-[22px] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingStore ? "Modifica Store" : "Nuovo Store"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingStore ? "Modifica i dati dello store" : "Inserisci i dati del nuovo store"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="store-name" className="text-xs font-medium">Nome *</Label>
              <Input
                id="store-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="es. Milano Duomo"
                className="rounded-[10px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-city" className="text-xs font-medium">Città</Label>
              <Input
                id="store-city"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="es. Milano"
                className="rounded-[10px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-address" className="text-xs font-medium">Indirizzo</Label>
              <Input
                id="store-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="es. Via Dante 12"
                className="rounded-[10px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="rounded-[10px]">
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              disabled={createStore.isPending || updateStore.isPending}
              className="rounded-[10px]"
            >
              {editingStore ? "Salva" : "Crea Store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageStores;
