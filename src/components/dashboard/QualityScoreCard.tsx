import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7));
  return mon.toISOString().split("T")[0];
}

function scoreColor(score: number) {
  if (score >= 80) return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", label: "Ottimo" };
  if (score >= 60) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", label: "Buono" };
  return { text: "text-destructive", bg: "bg-destructive", label: "Critico" };
}

export function QualityScoreCard() {
  const { activeStore } = useAuth();
  const weekStart = getWeekStart();

  const { data: runs, isLoading } = useQuery({
    queryKey: ["generation-runs-quality", activeStore?.id, weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_runs")
        .select("id, department, quality_score, status, created_at, validation_result")
        .eq("store_id", activeStore!.id)
        .eq("week_start", weekStart)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeStore?.id,
  });

  const hasRuns = (runs?.length ?? 0) > 0;
  const avgScore = hasRuns
    ? Math.round((runs ?? []).reduce((s, r) => s + (r.quality_score ?? 0), 0) / (runs?.length ?? 1))
    : null;

  const colors = avgScore !== null ? scoreColor(avgScore) : null;

  return (
    <Card className="p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Qualità turno settimana</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Caricamento…</span>
        </div>
      ) : !hasRuns ? (
        <div>
          <p className="text-sm text-muted-foreground">Nessun turno generato</p>
          <Link to="/team-calendar" className="text-xs text-primary hover:text-primary/80 mt-1 block">
            Vai al calendario →
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <p className={`text-3xl font-bold tracking-tight ${colors?.text}`}>
              {avgScore}
            </p>
            <span className="text-sm text-muted-foreground mb-0.5">/ 100</span>
            <Badge className={`ml-auto text-[10px] border-0 ${
              (avgScore ?? 0) >= 80
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : (avgScore ?? 0) >= 60
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-destructive/15 text-destructive"
            }`}>
              {colors?.label}
            </Badge>
          </div>

          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${colors?.bg}`}
              style={{ width: `${avgScore ?? 0}%` }}
            />
          </div>

          <div className="space-y-1">
            {(runs ?? []).map((run) => {
              const s = run.quality_score ?? 0;
              const c = scoreColor(s);
              const vr = run.validation_result as any;
              const hardViolations = vr?.hardViolations?.length ?? 0;
              return (
                <div key={run.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`font-medium capitalize ${c.text}`}>{run.department}</span>
                  <span className="font-bold">{s}</span>
                  {hardViolations > 0 && (
                    <span className="flex items-center gap-0.5 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {hardViolations} violazioni
                    </span>
                  )}
                  <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">{run.status}</Badge>
                </div>
              );
            })}
          </div>

          <Link to="/team-calendar" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Vedi calendario →
          </Link>
        </>
      )}
    </Card>
  );
}
