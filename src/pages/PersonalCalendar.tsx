import { useMemo, useCallback } from "react";
import { Calendar, Sun, Scissors, Download, Smartphone } from "lucide-react";
import { format, parseISO, startOfWeek, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatEndTime } from "@/lib/shiftColors";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generateIcsContent, downloadIcsFile } from "@/lib/icsExport";

interface PersonalShift {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  department: "sala" | "cucina";
  is_day_off: boolean;
  status: "draft" | "published" | "archived";
  store_id: string;
}

function usePersonalShifts(userId: string | undefined) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 13); // current + next week

  return useQuery({
    queryKey: ["personal-shifts", userId],
    queryFn: async (): Promise<PersonalShift[]> => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, department, is_day_off, status, store_id")
        .eq("user_id", userId!)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .in("status", ["published", "draft"])
        .order("date")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as PersonalShift[];
    },
    enabled: !!userId,
  });
}

function isSplitShift(shifts: PersonalShift[]): boolean {
  if (shifts.length < 2) return false;
  const work = shifts.filter(s => !s.is_day_off && s.start_time && s.end_time);
  return work.length >= 2;
}

const PersonalCalendar = () => {
  const { user } = useAuth();
  const { data: shifts = [], isLoading } = usePersonalShifts(user?.id);

  // Fetch employee contract hours
  const { data: employeeDetails } = useQuery({
    queryKey: ["employee-details-personal", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_details")
        .select("weekly_contract_hours")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const contractHours = employeeDetails?.weekly_contract_hours ?? 40;

  // Calculate current week hours
  const currentWeekHours = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const wsStr = format(weekStart, "yyyy-MM-dd");
    const weStr = format(weekEnd, "yyyy-MM-dd");
    return shifts
      .filter(s => !s.is_day_off && s.start_time && s.end_time && s.date >= wsStr && s.date <= weStr)
      .reduce((sum, s) => {
        const sh = parseInt(s.start_time!.split(":")[0], 10);
        let eh = parseInt(s.end_time!.split(":")[0], 10);
        if (eh === 0) eh = 24;
        return sum + (eh - sh);
      }, 0);
  }, [shifts]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, PersonalShift[]>();
    shifts.forEach(s => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [shifts]);

  const sortedDates = useMemo(() => 
    [...groupedByDate.keys()].sort(), 
    [groupedByDate]
  );

  const handleExportIcs = useCallback(() => {
    if (shifts.length === 0) {
      toast.info("Nessun turno da esportare");
      return;
    }
    const ics = generateIcsContent(shifts);
    downloadIcsFile(ics, `turni-${format(new Date(), "yyyy-MM-dd")}.ics`);
    toast.success("File .ics scaricato! Aprilo per aggiungerlo al tuo calendario");
  }, [shifts]);

  const handleSubscribeUrl = useCallback(() => {
    // Copy a hint for manual subscription
    const instructions = 
      "Per sincronizzare automaticamente:\n" +
      "1. Scarica il file .ics\n" +
      "2. Importalo in Google Calendar, Apple Calendar o Outlook\n" +
      "3. I turni appariranno nel tuo calendario";
    toast.info("Scarica il file .ics e importalo nella tua app calendario preferita");
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <PageHeader
          title="Calendario Personale"
          subtitle="I tuoi turni e la tua pianificazione settimanale"
        />
      <div className="flex items-center gap-2">
        {!isLoading && shifts.length > 0 && (
          <Badge
            variant={currentWeekHours >= contractHours ? "default" : "secondary"}
            className="text-xs px-2.5 py-1 shrink-0"
          >
            {currentWeekHours}h / {contractHours}h
          </Badge>
        )}
      {shifts.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">Esporta</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">Sincronizza col telefono</h4>
                  <p className="text-xs text-muted-foreground">
                    Scarica il file .ics e importalo in Google Calendar, Apple Calendar o Outlook.
                  </p>
                </div>
                <Button onClick={handleExportIcs} className="w-full gap-2" size="sm">
                  <Download className="h-4 w-4" />
                  Scarica file .ics
                </Button>
                <div className="border-t border-border pt-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong>Google Calendar:</strong> Impostazioni → Importa ed esporta → Importa<br />
                    <strong>Apple Calendar:</strong> Apri il file .ics → Aggiungi<br />
                    <strong>Outlook:</strong> File → Apri e Esporta → Importa
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Nessun turno assegnato"
          description="Qui vedrai i tuoi turni personali una volta che saranno stati generati."
        />
      ) : (
        <div className="space-y-2">
          {sortedDates.map(dateStr => {
            const dayShifts = groupedByDate.get(dateStr)!;
            const isDayOff = dayShifts.some(s => s.is_day_off);
            const isSplit = isSplitShift(dayShifts);
            const d = parseISO(dateStr);
            const dayName = format(d, "EEEE", { locale: it });
            const dateLabel = format(d, "d MMMM", { locale: it });
            const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;

            return (
              <Card
                key={dateStr}
                className={cn(
                  "p-4 transition-all",
                  isDayOff && "border-destructive/30 bg-destructive/5",
                  isSplit && !isDayOff && "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20",
                  isToday && "ring-2 ring-primary/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold capitalize text-foreground">
                        {dayName}
                      </span>
                      <span className="text-xs text-muted-foreground">{dateLabel}</span>
                      {isToday && (
                        <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">
                          Oggi
                        </Badge>
                      )}
                      {dayShifts[0]?.status === "draft" && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-amber-600 border-amber-300">
                          Draft
                        </Badge>
                      )}
                    </div>

                    {isDayOff ? (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <Sun className="h-4 w-4" />
                        <span className="text-sm font-medium">Giorno di riposo</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {dayShifts.filter(s => !s.is_day_off).map(s => (
                          <div key={s.id} className="flex items-center gap-2">
                            <span className="text-base font-semibold text-foreground tabular-nums">
                              {s.start_time?.slice(0, 5)} – {formatEndTime(s.end_time)}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-4 capitalize"
                            >
                              {s.department}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {isSplit && !isDayOff && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Scissors className="h-4 w-4" />
                      <span className="text-[10px] font-semibold">Spezzato</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PersonalCalendar;
