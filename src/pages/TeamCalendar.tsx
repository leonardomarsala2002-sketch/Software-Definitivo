import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Wand2, CheckCircle2, Loader2, AlertTriangle, Send, Stethoscope } from "lucide-react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMonthShifts, useCreateShift, useUpdateShift, useDeleteShift } from "@/hooks/useShifts";
import { useEmployeeList } from "@/hooks/useEmployees";
import { useOpeningHours, useAllowedTimes, useCoverageRequirements } from "@/hooks/useStoreSettings";
import { useGenerateShifts, usePublishWeek, useApprovePatchShifts, useWeekGenerationRuns } from "@/hooks/useGenerationRuns";
import { useOptimizationSuggestions, useLendingSuggestions, type OptimizationSuggestion, type CorrectionAction } from "@/hooks/useOptimizationSuggestions";
import { useStoreLendings } from "@/hooks/useLendingData";
import { MonthGrid } from "@/components/team-calendar/MonthGrid";
import { DayDetailDialog } from "@/components/team-calendar/DayDetailDialog";
import { SuggestionWizardDialog } from "@/components/team-calendar/SuggestionWizardDialog";
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
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  const [showOptimizationErrors, setShowOptimizationErrors] = useState(false);

  const { data: shifts = [], isLoading: loadingShifts } = useMonthShifts(storeId, year, month);
  const { data: allEmployees = [], isLoading: loadingEmp } = useEmployeeList();
  const { data: openingHours = [] } = useOpeningHours(storeId);
  const { data: lendings = [] } = useStoreLendings(storeId, year, month);
  const { data: allowedTimes = [] } = useAllowedTimes(storeId);
  const { data: coverageReqs = [] } = useCoverageRequirements(storeId);

  const currentWeekStart = useMemo(() => {
    if (selectedWeek !== null) {
      return getWeekStartForWeek(year, month, selectedWeek);
    }
    const nextMon = startOfWeek(addDays(now, 7), { weekStartsOn: 1 });
    return format(nextMon, "yyyy-MM-dd");
  }, [selectedWeek, year, month]);

  const { data: generationRuns = [] } = useWeekGenerationRuns(storeId, currentWeekStart);

  // Fetch suggestions only from the LATEST completed run per department
  const latestRunIds = useMemo(() => {
    const latest = new Map<string, string>(); // dept -> run id
    for (const r of generationRuns) {
      if (r.status === "completed" && !latest.has(r.department)) {
        latest.set(r.department, r.id); // already sorted desc by created_at
      }
    }
    return Array.from(latest.values());
  }, [generationRuns]);
  const { suggestions } = useOptimizationSuggestions(latestRunIds);
  const { data: dbLendingSuggestions = [] } = useLendingSuggestions(latestRunIds);

  const generateShifts = useGenerateShifts();
  const publishWeek = usePublishWeek();
  const approvePatch = useApprovePatchShifts();
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

  // Check if ANY department has draft shifts (for week-level publish)
  const hasAnyDraftShifts = useMemo(() => {
    return shifts.some(s => s.status === "draft");
  }, [shifts]);

  // Detect patch mode: drafts coexist with published shifts in the same week
  const isPatchProposal = useMemo(() => {
    const hasDrafts = shifts.some(s => s.status === "draft");
    const hasPublished = shifts.some(s => s.status === "published");
    return hasDrafts && hasPublished;
  }, [shifts]);

  // Get generation run IDs for patch approval
  const patchRunIds = useMemo(() => {
    return generationRuns
      .filter(r => r.status === "completed" && r.notes?.includes("patch"))
      .map(r => r.id);
  }, [generationRuns]);

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
    return suggestions.some(s => s.severity === "critical" || s.type === "uncovered");
  }, [suggestions]);

  // Auto-show blocking optimization errors popup when generation completes with critical issues
  useEffect(() => {
    if (hasCriticalConflicts && hasDraftShifts && canEdit) {
      setShowOptimizationErrors(true);
    }
  }, [hasCriticalConflicts, hasDraftShifts, canEdit]);

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
      week_start: currentWeekStart,
    }, {
      onSuccess: () => {
        // Auto-navigate to the month containing the generated week
        const genDate = new Date(currentWeekStart + "T00:00:00");
        const targetMonth = genDate.getMonth() + 1;
        const targetYear = genDate.getFullYear();
        if (targetMonth !== month || targetYear !== year) {
          setMonth(targetMonth);
          setYear(targetYear);
        }
      }
    });
    setShowGenerateConfirm(false);
  };

  const handlePublishWeek = () => {
    if (!storeId) return;
    publishWeek.mutate({ store_id: storeId, week_start: currentWeekStart });
    setShowPublishConfirm(false);
  };

  const handleApprovePatch = () => {
    if (!storeId) return;
    approvePatch.mutate({
      store_id: storeId,
      week_start: currentWeekStart,
      generation_run_ids: patchRunIds,
    });
    setShowApproveConfirm(false);
  };

  const handleAcceptSuggestion = async (suggestion: OptimizationSuggestion, action?: CorrectionAction) => {
    if (!storeId) return;

    // Helper to track adjustment
    const trackAdjustment = async (userId: string, adjustmentType: string, extraHours: number, notes?: string) => {
      try {
        await supabase.from("generation_adjustments").insert({
          store_id: storeId,
          user_id: userId,
          week_start: currentWeekStart,
          adjustment_type: adjustmentType,
          extra_hours: extraHours,
          notes: notes ?? null,
          source_suggestion_id: suggestion.id ?? null,
        } as any);
      } catch (e) {
        console.error("Failed to track adjustment:", e);
      }
    };

    // If there's a specific corrective action, apply it
    if (action) {
      if (action.actionType === "shift_earlier" || action.actionType === "shift_later" || action.actionType === "extend_shift") {
        // Find the shift for this user on this date and update it
        const userShifts = shifts.filter(s => s.user_id === action.userId && s.date === suggestion.date && !s.is_day_off);
        if (userShifts.length > 0) {
          const oldStart = parseInt(userShifts[0].start_time?.split(":")[0] ?? "0", 10);
          const oldEnd = parseInt(userShifts[0].end_time?.split(":")[0] ?? "0", 10);
          const newStart = action.newStartTime ? parseInt(action.newStartTime.split(":")[0], 10) : oldStart;
          const newEnd = action.newEndTime ? parseInt(action.newEndTime.split(":")[0], 10) : oldEnd;
          const extraHours = (newEnd - newStart) - (oldEnd - oldStart);

          updateShift.mutate({
            id: userShifts[0].id,
            updates: {
              start_time: action.newStartTime ? `${action.newStartTime}:00` : undefined,
              end_time: action.newEndTime ? `${action.newEndTime}:00` : undefined,
            },
          });
          toast.success(`Turno di ${action.userName} modificato`);
          if (action.userId) trackAdjustment(action.userId, action.actionType, extraHours, `${action.userName}: ${action.newStartTime ?? ""}–${action.newEndTime ?? ""}`);
        }
      } else if (action.actionType === "add_split") {
        // Create a new shift
        createShift.mutate({
          store_id: storeId,
          department,
          user_id: action.userId!,
          date: suggestion.date!,
          start_time: action.newStartTime ? `${action.newStartTime}:00` : null,
          end_time: action.newEndTime ? `${action.newEndTime}:00` : null,
          is_day_off: false,
        });
        toast.success(`Turno aggiunto per ${action.userName}`);
        const splitHours = action.newStartTime && action.newEndTime
          ? parseInt(action.newEndTime.split(":")[0], 10) - parseInt(action.newStartTime.split(":")[0], 10)
          : 0;
        if (action.userId) trackAdjustment(action.userId, "add_split", splitHours, `${action.userName}: spezzato ${action.newStartTime}–${action.newEndTime}`);
      } else if (action.actionType === "lending") {
        // Create lending request - needs dual approval
        if (action.sourceStoreId && action.userId) {
          const { error } = await supabase.from("shifts").insert({
            store_id: storeId,
            user_id: action.userId,
            date: suggestion.date!,
            start_time: action.newStartTime ? `${action.newStartTime}:00` : null,
            end_time: action.newEndTime ? `${action.newEndTime}:00` : null,
            department,
            is_day_off: false,
            status: "draft",
          } as any);
          if (error) {
            toast.error("Errore: " + error.message);
          } else {
            toast.success(`Prestito di ${action.userName} da ${action.sourceStoreName} richiesto`);
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            const lendingHours = action.newStartTime && action.newEndTime
              ? parseInt(action.newEndTime.split(":")[0], 10) - parseInt(action.newStartTime.split(":")[0], 10)
              : 0;
            trackAdjustment(action.userId, "lending", lendingHours, `Prestito da ${action.sourceStoreName}`);
          }
        }
      } else if (action.actionType === "remove_surplus") {
        // Find and remove the surplus shift
        const userShifts = shifts.filter(s => s.user_id === action.userId && s.date === suggestion.date && !s.is_day_off);
        if (userShifts.length > 0) {
          const removedHours = userShifts[0].start_time && userShifts[0].end_time
            ? parseInt(userShifts[0].end_time.split(":")[0], 10) - parseInt(userShifts[0].start_time.split(":")[0], 10)
            : 0;
          deleteShift.mutate({ id: userShifts[0].id, storeId });
          toast.success(`Turno di ${action.userName} rimosso`);
          if (action.userId) trackAdjustment(action.userId, "remove_surplus", -removedHours, `${action.userName}: turno rimosso`);
        }
      }
      return;
    }

    // Fallback behavior (no specific action)
    if (suggestion.type === "uncovered" && suggestion.date) {
      setSelectedDate(suggestion.date);
    } else if (suggestion.type === "surplus" && suggestion.shiftId) {
      deleteShift.mutate({ id: suggestion.shiftId, storeId });
      toast.success(`Turno di ${suggestion.userName} rimosso`);
    } else if (suggestion.type === "lending" && suggestion.shiftId && suggestion.targetStoreId) {
      const isDbLending = suggestion.id.startsWith("db-lending-");
      if (isDbLending) {
        const lendingId = suggestion.shiftId;
        const dbSuggestion = dbLendingSuggestions.find(ls => ls.id === lendingId);
        if (dbSuggestion) {
          const { error: createErr } = await supabase.from("shifts").insert({
            store_id: suggestion.targetStoreId,
            user_id: dbSuggestion.user_id,
            date: dbSuggestion.suggested_date,
            start_time: dbSuggestion.suggested_start_time,
            end_time: dbSuggestion.suggested_end_time,
            department: dbSuggestion.department as "sala" | "cucina",
            is_day_off: false,
            status: "draft",
          } as any);
          if (createErr) {
            toast.error("Errore: " + createErr.message);
            return;
          }
          await supabase.from("lending_suggestions").update({ status: "accepted" } as any).eq("id", lendingId);
          queryClient.invalidateQueries({ queryKey: ["shifts"] });
          queryClient.invalidateQueries({ queryKey: ["lending-suggestions"] });
          toast.success(`${suggestion.userName} prestato a ${suggestion.targetStoreName}`);
        }
      }
    } else if (suggestion.type === "overtime_balance" && suggestion.userId) {
      toast.info(`Bilanciamento ore per ${suggestion.userName}: verrà compensato nella prossima generazione`);
    }
  };

  const handleDeclineSuggestion = (id: string) => {
    // No-op for wizard (handled internally)
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
    <div className="flex flex-col h-full">
      {/* Compact header with controls */}
      <div className="flex flex-wrap items-center gap-3 mb-3 flex-shrink-0">
        {/* Title */}
        <div className="mr-auto">
          <h1 className="text-lg font-bold tracking-tight text-[#111]">Calendario Team</h1>
          <p className="text-[11px] text-[#444]">
            {activeStore?.name ?? "Store"} · {department === "sala" ? "Sala" : "Cucina"}
          </p>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-[32px]" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold capitalize min-w-[140px] text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-[32px]" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Department toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-[32px] p-0.5">
          {(["sala", "cucina"] as const).map((d) => (
            <button
              key={d}
              className={`px-3 py-1 text-xs font-medium rounded-[32px] transition-colors capitalize ${
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

        {/* Action buttons */}
        {canEdit && (
          <div className="flex items-center gap-2">
            {hasDraftShifts && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-[32px]">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Draft
              </Badge>
            )}

            {isPatchProposal && (
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowApproveConfirm(true)}
                disabled={approvePatch.isPending}
                className="gap-1.5 rounded-[32px]"
              >
                {approvePatch.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Approva Proposta
              </Button>
            )}

            {hasAnyDraftShifts && !isPatchProposal && (
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  if (hasCriticalConflicts) {
                    setShowOptimizationErrors(true);
                  } else {
                    setShowPublishConfirm(true);
                  }
                }}
                disabled={publishWeek.isPending}
                className="gap-1.5 rounded-[32px]"
                title={hasCriticalConflicts ? "Risolvi i conflitti critici prima di pubblicare" : undefined}
              >
                {publishWeek.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Pubblica Settimana
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowGenerateConfirm(true)}
              disabled={generateShifts.isPending}
              className="gap-1.5 rounded-[32px]"
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

      {/* Warning banner when suggestions exist but wizard is dismissed */}
      {canEdit && !showOptimizationErrors && suggestions.length > 0 && hasDraftShifts && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs text-amber-800 dark:text-amber-300 font-medium flex-1">
            Ci sono <strong>{suggestions.length}</strong> problemi da risolvere prima di pubblicare i turni.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] px-3 gap-1.5 rounded-[32px] border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/50"
            onClick={() => setShowOptimizationErrors(true)}
          >
            <Stethoscope className="h-3 w-3" />
            Risolvi ora
          </Button>
        </div>
      )}

      {/* Full-view calendar */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <Skeleton className="h-full w-full rounded-[32px]" />
        ) : (
          <MonthGrid
            year={year}
            month={month}
            shifts={shifts}
            employees={employees}
            department={department}
            selectedWeek={selectedWeek}
            onDayClick={(date) => setSelectedDate(date)}
            uncoveredDates={uncoveredSlotsMap}
            balances={[]}
            currentStoreId={storeId}
            totalWeeks={totalWeeks}
            lendings={lendings}
          />
        )}
      </div>

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
          lendings={lendings.filter(l => l.suggested_date === selectedDate)}
          currentStoreId={storeId}
          onCreateShift={(s) =>
            createShift.mutate({ store_id: storeId!, department, ...s })
          }
          onUpdateShift={(id, updates) => updateShift.mutate({ id, updates })}
          onDeleteShift={(id) => deleteShift.mutate({ id, storeId })}
        />
      )}

      {/* Step-by-step Suggestion Wizard */}
      {canEdit && (
        <SuggestionWizardDialog
          open={showOptimizationErrors && suggestions.length > 0}
          suggestions={suggestions}
          onAccept={handleAcceptSuggestion}
          onDecline={handleDeclineSuggestion}
          onClose={() => setShowOptimizationErrors(false)}
          onNavigateToDay={(date) => {
            const d = new Date(date + "T00:00:00");
            const targetMonth = d.getMonth() + 1;
            const targetYear = d.getFullYear();
            if (targetMonth !== month || targetYear !== year) {
              setMonth(targetMonth);
              setYear(targetYear);
            }
            setSelectedDate(date);
          }}
        />
      )}

      {/* Generate confirmation dialog */}
      <AlertDialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
        <AlertDialogContent className="rounded-[32px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Genera turni settimanali</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno eseguite <strong>40 iterazioni</strong> dell'algoritmo per trovare la combinazione ottimale
              dei turni per <strong>Sala e Cucina</strong> a partire
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
        <AlertDialogContent className="rounded-[32px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Pubblica Settimana</AlertDialogTitle>
            <AlertDialogDescription>
              Tutti i turni draft della settimana <strong>{currentWeekStart}</strong> verranno pubblicati
              e ogni dipendente coinvolto riceverà una notifica email con i propri turni.
              Il monte ore (Hour Bank) verrà aggiornato permanentemente.
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
            <AlertDialogAction onClick={handlePublishWeek} disabled={hasCriticalConflicts}>
              Pubblica
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve patch confirmation dialog */}
      <AlertDialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <AlertDialogContent className="rounded-[32px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Approva Proposta di Copertura</AlertDialogTitle>
            <AlertDialogDescription>
              L'AI ha generato una proposta di copertura per gestire un'assenza.
              I turni draft verranno pubblicati e i dipendenti coinvolti riceveranno
              un'email con l'aggiornamento dei turni.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprovePatch}>
              Approva e Notifica
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamCalendar;
