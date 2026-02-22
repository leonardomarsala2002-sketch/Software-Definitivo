import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";
import type { ShiftRow } from "@/hooks/useShifts";

export interface OptimizationSuggestion {
  id: string;
  type: "surplus" | "lending" | "overtime_balance" | "uncovered";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  actionLabel: string;
  declineLabel: string;
  // Data needed to execute
  shiftId?: string;
  userId?: string;
  userName?: string;
  date?: string;
  suggestedHours?: number;
  sourceStoreId?: string;
  targetStoreId?: string;
  targetStoreName?: string;
}

interface EmployeeBalance {
  user_id: string;
  current_balance: number;
}

export function useEmployeeBalances(storeId: string | undefined) {
  return useQuery({
    queryKey: ["employee-stats", storeId],
    queryFn: async (): Promise<EmployeeBalance[]> => {
      const { data, error } = await supabase
        .from("employee_stats")
        .select("user_id, current_balance")
        .eq("store_id", storeId!);
      if (error) throw error;
      return (data ?? []).map(d => ({
        user_id: d.user_id,
        current_balance: Number(d.current_balance),
      }));
    },
    enabled: !!storeId,
  });
}

export function useLendingSuggestions(runId: string | undefined) {
  return useQuery({
    queryKey: ["lending-suggestions", runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lending_suggestions")
        .select("*")
        .eq("generation_run_id", runId!)
        .eq("status", "pending");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!runId,
  });
}

/**
 * Generates actionable suggestion cards from shifts, coverage, balances, and lending data
 */
export function useOptimizationSuggestions(
  shifts: ShiftRow[],
  department: "sala" | "cucina",
  coverageReqs: { day_of_week: number; hour_slot: string; department: string; min_staff_required: number }[],
  employees: { user_id: string; full_name: string | null; weekly_contract_hours?: number }[],
  balances: EmployeeBalance[],
  year: number,
  month: number,
  hasDraft: boolean,
): OptimizationSuggestion[] {
  return useMemo(() => {
    if (!hasDraft) return [];

    const suggestions: OptimizationSuggestion[] = [];
    const empMap = new Map(employees.map(e => [e.user_id, e]));
    const balMap = new Map(balances.map(b => [b.user_id, b.current_balance]));

    const deptShifts = shifts.filter(s => s.department === department && !s.is_day_off && s.start_time && s.end_time);
    const deptCoverage = coverageReqs.filter(c => c.department === department);

    // Group shifts by date
    const shiftsByDate = new Map<string, ShiftRow[]>();
    deptShifts.forEach(s => {
      const arr = shiftsByDate.get(s.date) ?? [];
      arr.push(s);
      shiftsByDate.set(s.date, arr);
    });

    const daysInMonth = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = (new Date(dateStr + "T00:00:00").getDay() + 6) % 7;
      const dayCov = deptCoverage.filter(c => c.day_of_week === dow);
      if (dayCov.length === 0) continue;

      const dayShifts = shiftsByDate.get(dateStr) ?? [];
      const dayLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "short" });

      for (const cov of dayCov) {
        const h = parseInt(cov.hour_slot.split(":")[0], 10);
        let staffCount = 0;
        const coveringShifts: ShiftRow[] = [];
        for (const s of dayShifts) {
          const sh = parseInt(s.start_time!.split(":")[0], 10);
          let eh = parseInt(s.end_time!.split(":")[0], 10);
          if (eh === 0) eh = 24;
          if (h >= sh && h < eh) {
            staffCount++;
            coveringShifts.push(s);
          }
        }

        // Uncovered
        if (staffCount < cov.min_staff_required) {
          suggestions.push({
            id: `uncov-${dateStr}-${h}`,
            type: "uncovered",
            severity: "critical",
            title: `Copertura mancante ${dayLabel} ore ${h}:00`,
            description: `Servono ${cov.min_staff_required} persone, assegnate ${staffCount}. Necessario intervento manuale.`,
            actionLabel: "Vai al giorno",
            declineLabel: "Ignora",
            date: dateStr,
          });
        }

        // Surplus (over-staffed by 2+)
        if (staffCount > cov.min_staff_required + 1) {
          const excess = staffCount - cov.min_staff_required;
          const lastShift = coveringShifts[coveringShifts.length - 1];
          const empName = empMap.get(lastShift.user_id)?.full_name ?? "Dipendente";
          suggestions.push({
            id: `surplus-${dateStr}-${h}`,
            type: "surplus",
            severity: "warning",
            title: `Surplus ${dayLabel} ore ${h}:00`,
            description: `Troppe persone (${staffCount}/${cov.min_staff_required}). Suggerimento: rimuovere il turno di ${empName}?`,
            actionLabel: "Rimuovi turno",
            declineLabel: "Ignora",
            shiftId: lastShift.id,
            userId: lastShift.user_id,
            userName: empName,
            date: dateStr,
          });
        }
      }
    }

    // Overtime balance suggestions
    // Calculate weekly hours per employee from draft shifts
    const weeklyHoursMap = new Map<string, number>();
    for (const s of deptShifts) {
      if ((s as any).status !== "draft") continue;
      const sh = parseInt(s.start_time!.split(":")[0], 10);
      let eh = parseInt(s.end_time!.split(":")[0], 10);
      if (eh === 0) eh = 24;
      weeklyHoursMap.set(s.user_id, (weeklyHoursMap.get(s.user_id) ?? 0) + (eh - sh));
    }

    for (const emp of employees) {
      const balance = balMap.get(emp.user_id) ?? 0;
      if (Math.abs(balance) >= 3) {
        const direction = balance > 0 ? "eccesso" : "deficit";
        const absBalance = Math.abs(balance);
        suggestions.push({
          id: `balance-${emp.user_id}`,
          type: "overtime_balance",
          severity: absBalance >= 5 ? "warning" : "info",
          title: `${emp.full_name ?? "Dipendente"}: ${direction} ${absBalance}h`,
          description: balance > 0
            ? `Ha accumulato +${absBalance}h. Suggerimento: ridurre il turno di ${Math.min(absBalance, 2)}h questa settimana.`
            : `Ha un deficit di ${absBalance}h. Suggerimento: aumentare le ore questa settimana.`,
          actionLabel: balance > 0 ? "Riduci turno" : "Aumenta ore",
          declineLabel: "Mantieni",
          userId: emp.user_id,
          userName: emp.full_name ?? "Dipendente",
          suggestedHours: Math.min(absBalance, 2),
        });
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return suggestions;
  }, [shifts, department, coverageReqs, employees, balances, year, month, hasDraft]);
}
