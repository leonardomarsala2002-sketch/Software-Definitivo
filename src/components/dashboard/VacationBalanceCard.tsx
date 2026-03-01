import { Card, CardContent } from "@/components/ui/card";
import { Palmtree } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function VacationBalanceCard() {
  const { user } = useAuth();

  const { data: balance, isLoading } = useQuery({
    queryKey: ["vacation-balance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("vacation_balance")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data?.vacation_balance ?? 0;
    },
    enabled: !!user?.id,
  });

  return (
    <Card className="p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Ferie rimanenti</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Palmtree className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {isLoading ? "—" : `${balance} gg`}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">giorni residui anno corrente</p>
      </div>
    </Card>
  );
}
