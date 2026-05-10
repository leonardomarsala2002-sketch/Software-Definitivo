import { Card, CardContent } from "@/components/ui/card";
import { Palmtree, Clock, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface LeaveBalance {
  ferie: { total_hours: number; used_hours: number };
  permesso: { total_hours: number; used_hours: number };
  permesso_104: { total_hours: number; used_hours: number };
}

function hoursToDisplay(hours: number): string {
  if (hours % 8 === 0) return `${hours / 8} gg`;
  const h = Math.floor(hours);
  return `${h}h`;
}

export function VacationBalanceCard() {
  const { user, activeStore } = useAuth();

  const { data: balances, isLoading } = useQuery({
    queryKey: ["leave-balance-detail", user?.id, activeStore?.id],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data, error } = await supabase
        .from("employee_leave_balances")
        .select("leave_type, total_hours, used_hours")
        .eq("user_id", user!.id)
        .eq("store_id", activeStore!.id)
        .eq("year", year);
      if (error) throw error;

      const result: LeaveBalance = {
        ferie: { total_hours: 0, used_hours: 0 },
        permesso: { total_hours: 0, used_hours: 0 },
        permesso_104: { total_hours: 0, used_hours: 0 },
      };
      for (const row of (data ?? [])) {
        const key = row.leave_type as keyof LeaveBalance;
        if (key in result) {
          result[key] = { total_hours: row.total_hours ?? 0, used_hours: row.used_hours ?? 0 };
        }
      }
      return result;
    },
    enabled: !!user?.id && !!activeStore?.id,
  });

  const rows: { label: string; icon: React.ElementType; key: keyof LeaveBalance; color: string }[] = [
    { label: "Ferie", icon: Palmtree, key: "ferie", color: "text-primary" },
    { label: "Permesso", icon: Clock, key: "permesso", color: "text-amber-500" },
    { label: "Perm. 104", icon: Heart, key: "permesso_104", color: "text-rose-500" },
  ];

  return (
    <Card className="p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Saldi ferie e permessi</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Palmtree className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="space-y-2">
        {rows.map(({ label, icon: Icon, key, color }) => {
          const row = balances?.[key];
          const residuo = (row?.total_hours ?? 0) - (row?.used_hours ?? 0);
          const total = row?.total_hours ?? 0;
          const pct = total > 0 ? Math.max(0, Math.min(100, (residuo / total) * 100)) : 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3 w-3 ${color}`} />
                  <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {isLoading ? "—" : `${hoursToDisplay(Math.max(0, residuo))} / ${hoursToDisplay(total)}`}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${residuo <= 0 ? "bg-destructive/60" : key === "ferie" ? "bg-primary" : key === "permesso" ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: isLoading ? "0%" : `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
