import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Wand2, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import { it } from "date-fns/locale";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMonthShifts, useCreateShift, useUpdateShift, useDeleteShift } from "@/hooks/useShifts";
import { useEmployeeList } from "@/hooks/useEmployees";
import { useOpeningHours, useAllowedTimes, useCoverageRequirements } from "@/hooks/useStoreSettings";
import { useGenerateShifts, usePublishShifts, useWeekGenerationRuns } from "@/hooks/useGenerationRuns";
import { useEmployeeBalances, useAllStoreShortages, useOptimizationSuggestions, type OptimizationSuggestion } from "@/hooks/useOptimizationSuggestions";
import { KpiCards } from "@/components/team-calendar/KpiCards";
import { MonthGrid } from "@/components/team-calendar/MonthGrid";
import { DayDetailDialog } from "@/components/team-calendar/DayDetailDialog";
import { OptimizationPanel } from "@/components/team-calendar/OptimizationPanel";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";

function getWeekStartForWeek(year: number, month: number, weekIdx: number): string {
  const firstDay = new Date(year, month - 1, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const dayOfMonth = weekIdx * 7 - startDow + 1;
  const d = new Date(year, month - 1, dayOfMonth);
  const mon = startOfWeek(d, { weekStartsOn: 1 });
  return format(mon, "yyyy-MM-dd");
}

const TeamCalendar = () => {
  const queryClient = useQueryClient();
  const { activeStore, role } = useAuth();
  const storeId = activeStore?.id;
  const canEdit = role === "super_admin" || role === "admin";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [department, setDepartment] = useState<"sala" | "cucina">("sala");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const { data: shifts = [], isLoading: loadingShifts } = useMonthShifts(storeId, year, month);
  const { data: allEmployees = [], isLoading: loadingEmp } = useEmployeeList();
  const { data: openingHours = [] } = useOpeningHours(storeId);
  const { data: allowedTimes = [] } = useAllowedTimes(storeId);
  const { data: coverageReqs = [] } = useCoverageRequirements(storeId);
  const { data: balances = [] } = useEmployeeBalances(storeId);
  const { data: crossStoreShortages = [] } = useAllStoreShortages(storeId, department, year, month);

  const currentWeekStart = useMemo(() => {
    if (selectedWeek !== null) {
      return getWeekStartForWeek(year, month, selectedWeek);
    }
    const nextMon = startOfWeek(addDays(now, 7), { weekStartsOn: 1 });
    return format(nextMon, "yyyy-MM-dd");
  }, [selectedWeek, year, month]);

  const { data: generationRuns = [] } = useWeekGenerationRuns(storeId, currentWeekStart);

  const generateShifts = useGenerateShifts();
  const publishShifts = usePublishShifts();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const activeDraftRun = useMemo(() => {
    return generationRuns.find(
      r => r.department === department && (r.status === "completed" || r.status === "running")
    );
  }, [generationRuns, department]);

  const hasDraftShifts = useMemo(() => {
    return shifts.some(s => s.status === "draft" && s.department === department);
  }, [shifts, department]);

  const employees = useMemo(() => {
    return allEmployees
      .filter((e) => e.department === department && e.is_active && e.primary_store_id === storeId)
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [allEmployees, department, storeId]);

  const allowedEntries = useMemo(
    () => allowedTimes.filter((t) => t.department === department && t.kind === "entry" && t.is_active).map((t) => t.hour).sort((a, b) => a - b),
    [allowedTimes, department]
  );

  const allowedExits = useMemo(
    () => allowedTimes.filter((t) => t.department === department && t.kind === "exit" && t.is_active).map((t) => t.hour).sort((a, b) => a - b),
    [allowedTimes, department]
  );

  // Optimization suggestions with cross-store lending priority
  const suggestions = useOptimizationSuggestions(
    shifts,
    department,
    coverageReqs,
    employees.map(e => ({ user_id: e.user_id, full_name: e.full_name, weekly_contract_hours: e.weekly_contract_hours })),
    balances,
    year,
    month,
    hasDraftShifts,
    crossStoreShortages,
  );

  // Build uncovered slots map for visual highlighting
  const uncoveredSlotsMap = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (coverageReqs.length === 0) return map;

    const deptCoverage = coverageReqs.filter(c => c.department === department);
    const deptShifts = shifts.filter(s => s.department === department && !s.is_day_off && s.start_time && s.end_time);

    const shiftsByDate = new Map<string, typeof deptShifts>();
    deptShifts.forEach(s => {
      const arr = shiftsByDate.get(s.date) ?? [];
      arr.push(s);
      shiftsByDate.set(s.date, arr);
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = (new Date(dateStr + "T00:00:00").getDay() + 6) % 7;
      const dayCoverage = deptCoverage.filter(c => c.day_of_week === dow);
      if (dayCoverage.length === 0) continue;

      const dayShifts = shiftsByDate.get(dateStr) ?? [];
      const uncoveredHours = new Set<number>();

      for (const cov of dayCoverage) {
        const h = parseInt(cov.hour_slot.split(":")[0], 10);
        let staffCount = 0;
        for (const s of dayShifts) {
          const sh = parseInt(s.start_time!.split(":")[0], 10);
          let eh = parseInt(s.end_time!.split(":")[0], 10);
          if (eh === 0) eh = 24;
          if (h >= sh && h < eh) staffCount++;
        }
        if (staffCount < cov.min_staff_required) {
          uncoveredHours.add(h);
        }
      }

      if (uncoveredHours.size > 0) {
        map.set(dateStr, uncoveredHours);
      }
    }
    return map;
  }, [coverageReqs, shifts, department, year, month]);

  const hasCriticalConflicts = useMemo(() => {
    return suggestions.some(s => s.severity === "critical");
  }, [suggestions]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
    setSelectedWeek(null);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
    setSelectedWeek(null);
  };

  const monthLabel = format(new Date(year, month - 1), "MMMM yyyy", { locale: it });

  const firstDay = new Date(year, month - 1, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalWeeks = Math.ceil((startDow + daysInMonth) / 7);

  const isLoading = loadingShifts || loadingEmp;

  const handleGenerate = () => {
    if (!storeId) return;
    generateShifts.mutate({
      store_id: storeId,
      department,
      week_start: currentWeekStart,
    });
    setShowGenerateConfirm(false);
  };

  const handlePublish = () => {
    if (!activeDraftRun) return;
    publishShifts.mutate(activeDraftRun.id);
    setShowPublishConfirm(false);
  };

  const handleAcceptSuggestion = async (suggestion: OptimizationSuggestion) => {
    if (suggestion.type === "surplus" && suggestion.shiftId) {
      deleteShift.mutate(suggestion.shiftId);
      toast.success(`Turno di ${suggestion.userName} rimosso`);
    } else if (suggestion.type === "lending" && suggestion.shiftId && suggestion.targetStoreId) {
      // Update shift store_id to target store (lending)
      const { error } = await supabase
        .from("shifts")
        .update({ store_id: suggestion.targetStoreId } as any)
        .eq("id", suggestion.shiftId);
      if (error) {
        toast.error("Errore nel prestito: " + error.message);
      } else {
        toast.success(`${suggestion.userName} prestato a ${suggestion.targetStoreName}`);
        // Refresh shifts
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
      }
    } else if (suggestion.type === "hour_reduction" && suggestion.shiftId && suggestion.suggestedHours) {
      // Reduce shift end_time by suggestedHours
      const shift = shifts.find(s => s.id === suggestion.shiftId);
      if (shift?.end_time) {
        const endH = parseInt(shift.end_time.split(":")[0], 10);
        const newEnd = Math.max(endH - suggestion.suggestedHours, parseInt(shift.start_time?.split(":")[0] ?? "0", 10) + 1);
        updateShift.mutate({
          id: suggestion.shiftId,
          updates: { end_time: `${String(newEnd).padStart(2, "0")}:00:00` },
        });
        toast.success(`Turno di ${suggestion.userName} ridotto di ${suggestion.suggestedHours}h`);
      }
    } else if (suggestion.type === "overtime_balance" && suggestion.userId) {
      toast.info(`Bilanciamento ore per ${suggestion.userName}: applicare nel dettaglio giornaliero`);
    }
  };

  const handleApplyAll = () => {
    const actionable = suggestions.filter(s => s.type !== "uncovered");
    let applied = 0;
    for (const s of actionable) {
      handleAcceptSuggestion(s);
      applied++;
    }
    toast.success(`${applied} soluzioni AI applicate`);
  };

  if (!storeId) {
    return (
      <div>
        <PageHeader title="Calendario Team" subtitle="Seleziona uno store per visualizzare il calendario" />
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="Nessuno store selezionato"
          description="Seleziona uno store dalla barra laterale."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Calendario Team"
        subtitle={`${activeStore?.name ?? "Store"} · ${department === "sala" ? "Sala" : "Cucina"}`}
      />

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold capitalize min-w-[140px] text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Department toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(["sala", "cucina"] as const).map((d) => (
            <button
              key={d}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                department === d
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setDepartment(d)}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Week selector */}
        <div className="flex items-center gap-1">
          <button
            className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
              selectedWeek === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setSelectedWeek(null)}
          >
            Tutto
          </button>
          {Array.from({ length: totalWeeks }, (_, i) => (
            <button
              key={i}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                selectedWeek === i
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setSelectedWeek(i)}
            >
              W{i + 1}
            </button>
          ))}
        </div>

        {/* Generation buttons - only for admin/super_admin */}
        {canEdit && (
          <div className="flex items-center gap-2 ml-auto">
            {hasDraftShifts && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Draft
              </Badge>
            )}

            {activeDraftRun && activeDraftRun.status === "completed" && (
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowPublishConfirm(true)}
                disabled={publishShifts.isPending || hasCriticalConflicts}
                className="gap-1.5"
                title={hasCriticalConflicts ? "Risolvi i conflitti critici prima di pubblicare" : undefined}
              >
                {publishShifts.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Approva e Pubblica
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowGenerateConfirm(true)}
              disabled={generateShifts.isPending}
              className="gap-1.5"
            >
              {generateShifts.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Genera Turni
            </Button>
          </div>
        )}
      </div>

      {/* Generation run info banner */}
      {activeDraftRun && activeDraftRun.status === "completed" && (
        <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
          <Wand2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <p className="font-semibold mb-1">
              Draft generato — Fitness: {activeDraftRun.fitness_score?.toFixed(1) ?? "N/A"}
              {activeDraftRun.iterations_run && ` (${activeDraftRun.iterations_run} iterazioni)`}
            </p>
            {activeDraftRun.notes && <p className="text-amber-700/80 dark:text-amber-400/80">{activeDraftRun.notes}</p>}
          </div>
        </div>
      )}

      {/* Optimization Panel - replaces static warning */}
      {canEdit && hasDraftShifts && suggestions.length > 0 && (
        <OptimizationPanel
          suggestions={suggestions}
          onAccept={handleAcceptSuggestion}
          onDecline={() => {}}
          onApplyAll={handleApplyAll}
          onNavigateToDay={(date) => setSelectedDate(date)}
        />
      )}

      {/* Uncovered slots warning (only if no draft / optimization panel not shown) */}
      {(!hasDraftShifts || !canEdit) && uncoveredSlotsMap.size > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs text-destructive">
            <p className="font-semibold mb-1">Copertura insufficiente in {uncoveredSlotsMap.size} giorni</p>
            <p className="text-destructive/80">
              Alcuni slot orari non raggiungono il minimo di personale richiesto.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : (
        <>
          <KpiCards shifts={shifts} employeeCount={employees.length} year={year} month={month} />

          <MonthGrid
            year={year}
            month={month}
            shifts={shifts}
            employees={employees}
            department={department}
            selectedWeek={selectedWeek}
            onDayClick={(date) => setSelectedDate(date)}
            uncoveredDates={uncoveredSlotsMap}
            balances={balances}
            currentStoreId={storeId}
          />

          {selectedDate && (
            <DayDetailDialog
              open={!!selectedDate}
              onOpenChange={(v) => !v && setSelectedDate(null)}
              date={selectedDate}
              department={department}
              shifts={shifts}
              employees={employees}
              openingHours={openingHours}
              allowedEntries={allowedEntries}
              allowedExits={allowedExits}
              canEdit={canEdit}
              onCreateShift={(s) =>
                createShift.mutate({ store_id: storeId!, department, ...s })
              }
              onUpdateShift={(id, updates) => updateShift.mutate({ id, updates })}
              onDeleteShift={(id) => deleteShift.mutate(id)}
            />
          )}
        </>
      )}

      {/* Generate confirmation dialog */}
      <AlertDialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Genera turni settimanali</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno eseguite <strong>40 iterazioni</strong> dell'algoritmo per trovare la combinazione ottimale
              dei turni per <strong className="capitalize">{department}</strong> a partire
              da <strong>{currentWeekStart}</strong>. Il sistema terrà conto del monte ore accumulato (Hour Bank)
              per bilanciare automaticamente le ore tra le settimane. I turni draft esistenti verranno sostituiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate}>Genera</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish confirmation dialog */}
      <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approva e pubblica turni</AlertDialogTitle>
            <AlertDialogDescription>
              I turni draft verranno pubblicati e tutti i dipendenti coinvolti riceveranno una notifica email.
              Il monte ore (Hour Bank) verrà aggiornato permanentemente per ogni dipendente.
              {hasCriticalConflicts && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ Non puoi pubblicare: ci sono ancora conflitti critici da risolvere nel Pannello Ottimizzazione.
                </span>
              )}
              {!hasCriticalConflicts && uncoveredSlotsMap.size > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠ Ci sono {uncoveredSlotsMap.size} giorni con avvisi di copertura (non critici).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={hasCriticalConflicts}>
              Pubblica
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamCalendar;
