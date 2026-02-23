import { useState, useMemo } from "react";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmptyState from "@/components/EmptyState";
import RequestForm from "@/components/requests/RequestForm";
import RequestsList from "@/components/requests/RequestsList";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreRequests, useMyRequests } from "@/hooks/useRequests";
import { useEmployeeList } from "@/hooks/useEmployees";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

interface OutletContextType {
  accentColor: string;
  accentBorders: Record<string, string>;
}

const Requests = () => {
  const { user, role, activeStore } = useAuth();
  const storeId = activeStore?.id;
  const isAdmin = role === "super_admin" || role === "admin";

  const [showForm, setShowForm] = useState(false);

  // Get employee's department
  const { data: myDetails } = useQuery({
    queryKey: ["my-employee-details", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_details")
        .select("department")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const department = (myDetails?.department as "sala" | "cucina") ?? "sala";

  // Admin sees all store requests, employee sees own
  const { data: storeRequests, isLoading: storeLoading } = useStoreRequests(isAdmin ? storeId : undefined);
  const { data: myRequests, isLoading: myLoading } = useMyRequests(!isAdmin ? user?.id : undefined);

  const requests = isAdmin ? storeRequests : myRequests;
  const isLoading = isAdmin ? storeLoading : myLoading;

  // For admin: get profiles to show names
  const { data: employees } = useEmployeeList();
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    employees?.forEach((e) => m.set(e.user_id, e.full_name ?? e.email ?? ""));
    return m;
  }, [employees]);

  const pendingRequests = requests?.filter((r) => r.status === "pending") ?? [];
  const otherRequests = requests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔄</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Richieste</h1>
              <p className="text-xs text-muted-foreground">Ferie, permessi, cambi turno e malattie</p>
            </div>
          </div>
          {!showForm && (
            <Button size="sm" className="gap-2 rounded-2xl transition-all duration-300" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Nuova richiesta
            </Button>
          )}
        </div>
      </div>

      {showForm && storeId && (
        <Card className="mb-4 rounded-[24px] border border-border/40 shadow-bento shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Nuova richiesta</CardTitle>
          </CardHeader>
          <CardContent>
            <RequestForm
              department={department}
              storeId={storeId}
              onClose={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {(!requests || requests.length === 0) && !isLoading && !showForm ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="Nessuna richiesta"
            description="Le richieste di ferie, permessi e cambi turno appariranno qui."
          />
        </div>
      ) : (
        <Tabs defaultValue="pending" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="shrink-0 rounded-2xl">
            <TabsTrigger value="pending" className="text-xs rounded-xl">
              In attesa ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs rounded-xl">
              Storico ({otherRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="flex-1 overflow-auto mt-4">
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessuna richiesta in attesa
              </p>
            ) : (
              <RequestsList
                requests={pendingRequests}
                isLoading={isLoading ?? false}
                profiles={profileMap}
                isAdmin={isAdmin}
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-auto mt-4">
            {otherRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessuna richiesta nello storico
              </p>
            ) : (
              <RequestsList
                requests={otherRequests}
                isLoading={isLoading ?? false}
                profiles={profileMap}
                isAdmin={isAdmin}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Requests;
