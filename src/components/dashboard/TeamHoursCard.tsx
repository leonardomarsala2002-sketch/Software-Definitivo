import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, Utensils, ConciergeBell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function getISOWeekDates(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calcHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const sh = parseInt(start.split(":")[0]);
  let eh = parseInt(end.split(":")[0]);
  if (eh === 0) eh = 24;
  return Math.max(0, eh - sh);
}

const MONTHS_IT = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

export function TeamHoursCard() {
  const { activeStore, stores, role } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const isSuperAdmin = role === "super_admin";

  const weekDates = useMemo(() => getISOWeekDates(weekOffset), [weekOffset]);
  const weekStartStr = formatDate(weekDates[0]);
  const weekEndStr = formatDate(weekDates[6]);

  const storeId = activeStore?.id;

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["team-hours-shifts", storeId, weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("date, start_time, end_time, department, is_day_off")
        .eq("store_id", storeId!)
        .gte("date", weekStartStr)
        .lte("date", weekEndStr)
        .eq("is_day_off", false);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!storeId,
  });

  // Compute daily and weekly totals
  const { dailyData, weeklyTotals } = useMemo(() => {
    const daily = weekDates.map((d) => {
      const dateStr = formatDate(d);
      const dayShifts = shifts.filter((s) => s.date === dateStr);
      const sala = dayShifts
        .filter((s) => s.department === "sala")
        .reduce((sum, s) => sum + calcHours(s.start_time, s.end_time), 0);
      const cucina = dayShifts
        .filter((s) => s.department === "cucina")
        .reduce((sum, s) => sum + calcHours(s.start_time, s.end_time), 0);
      return { date: d, dateStr, sala, cucina, total: sala + cucina };
    });

    const weeklyTotals = {
      sala: daily.reduce((s, d) => s + d.sala, 0),
      cucina: daily.reduce((s, d) => s + d.cucina, 0),
      total: daily.reduce((s, d) => s + d.total, 0),
    };

    return { dailyData: daily, weeklyTotals };
  }, [shifts, weekDates]);

  const maxDayHours = Math.max(1, ...dailyData.map((d) => d.total));

  const weekLabel = `${weekDates[0].getDate()} ${MONTHS_IT[weekDates[0].getMonth()]} – ${weekDates[6].getDate()} ${MONTHS_IT[weekDates[6].getMonth()]}`;

  return (
    <Card className="p-4 flex flex-col">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          Ore team settimanali
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-normal text-muted-foreground min-w-[130px] text-center">
              {weekLabel}
            </span>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="ml-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors px-2 py-0.5 rounded-md bg-primary/10"
              >
                Oggi
              </button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Weekly summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-secondary p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Totale</p>
            <p className="text-xl font-bold text-foreground">{weeklyTotals.total}h</p>
          </div>
          <div className="rounded-xl bg-secondary p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ConciergeBell className="h-3 w-3 text-primary" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sala</p>
            </div>
            <p className="text-xl font-bold text-primary">{weeklyTotals.sala}h</p>
          </div>
          <div className="rounded-xl bg-secondary p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Utensils className="h-3 w-3 text-chart-4" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cucina</p>
            </div>
            <p className="text-xl font-bold text-chart-4">{weeklyTotals.cucina}h</p>
          </div>
        </div>

        {/* Daily bars */}
        <div className="space-y-2">
          {dailyData.map((day, i) => {
            const isToday = day.dateStr === formatDate(new Date());
            const salaWidth = maxDayHours > 0 ? (day.sala / maxDayHours) * 100 : 0;
            const cucinaWidth = maxDayHours > 0 ? (day.cucina / maxDayHours) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-3">
                <span
                  className={`w-10 text-right text-xs font-medium shrink-0 ${
                    isToday ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {DAYS_SHORT[i]}
                </span>
                <div className="flex-1 flex gap-0.5 h-5">
                  <div
                    className="h-full rounded-l-md bg-primary/80 transition-all duration-300"
                    style={{ width: `${salaWidth}%` }}
                  />
                  <div
                    className="h-full rounded-r-md bg-chart-4/80 transition-all duration-300"
                    style={{ width: `${cucinaWidth}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-foreground shrink-0">
                  {day.total}h
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary/80" />
            <span className="text-[11px] text-muted-foreground">Sala</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-chart-4/80" />
            <span className="text-[11px] text-muted-foreground">Cucina</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
