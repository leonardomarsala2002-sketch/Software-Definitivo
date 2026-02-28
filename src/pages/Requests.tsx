import { useState, useMemo } from "react";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RequestForm from "@/components/requests/RequestForm";
import RequestsList from "@/components/requests/RequestsList";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreRequests, useMyRequests } from "@/hooks/useRequests";
import { useEmployeeList } from "@/hooks/useEmployees";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const Requests = () => {
  const { user, role, activeStore } = useAuth();
  const storeId = activeStore?.id;
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";

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

  // Admin sees store requests + own requests; employee sees only own
  const { data: storeRequests, isLoading: storeLoading } = useStoreRequests(isAdmin ? storeId : undefined);
  const { data: myRequests, isLoading: myLoading } = useMyRequests(user?.id);

  // Admin: show both store requests and own requests merged
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

  // Super admin should never see this page, but just in case
  if (isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Richieste" subtitle="I super admin non gestiscono richieste" />
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Non disponibile"
          description="I super admin non hanno accesso alle richieste."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Richieste"
        subtitle={isAdmin ? "Gestisci le richieste del team e le tue" : "Ferie, permessi, cambi turno e malattie"}
      >
        {!showForm && (
          <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Nuova richiesta
          </Button>
        )}
      </PageHeader>

      {showForm && storeId && (
        <Card className="mb-6 border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Nuova richiesta</CardTitle>
          </CardHeader>
          <CardContent>
            <RequestForm
              department={department}
              storeId={storeId}
              onClose={() => setShowForm(false)}
              autoApprove={isAdmin}
            />
          </CardContent>
        </Card>
      )}

      {(!requests || requests.length === 0) && !isLoading && !showForm ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Nessuna richiesta"
          description="Le richieste di ferie, permessi e cambi turno appariranno qui."
        />
      ) : (
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="text-xs">
              In attesa ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              Storico ({otherRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
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

          <TabsContent value="history">
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
