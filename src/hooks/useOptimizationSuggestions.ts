import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import type { ShiftRow } from "@/hooks/useShifts";

export interface OptimizationSuggestion {
  id: string;
  type: "surplus" | "lending" | "overtime_balance" | "uncovered" | "hour_reduction";
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
  sourceStoreName?: string;
  targetStoreId?: string;
  targetStoreName?: string;
  slot?: string;
}

interface EmployeeBalance {
  user_id: string;
  current_balance: number;
}

interface StoreShortage {
  storeId: string;
  storeName: string;
  dateStr: string;
  hour: number;
  deficit: number;
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

export function useAllStoreShortages(storeId: string | undefined, department: "sala" | "cucina", year: number, month: number) {
  return useQuery({
    queryKey: ["cross-store-shortages", storeId, department, year, month],
    queryFn: async (): Promise<StoreShortage[]> => {
      // Get all stores the admin can see
      const { data: stores, error: storesErr } = await supabase
        .from("stores")
        .select("id, name")
        .eq("is_active", true);
      if (storesErr || !stores) return [];

      const otherStores = stores.filter(s => s.id !== storeId);
      if (otherStores.length === 0) return [];

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const shortages: StoreShortage[] = [];

      for (const store of otherStores) {
        const [covRes, shiftsRes] = await Promise.all([
          supabase.from("store_coverage_requirements").select("*").eq("store_id", store.id).eq("department", department),
          supabase.from("shifts").select("*").eq("store_id", store.id).eq("department", department).gte("date", startDate).lte("date", endDate),
        ]);

        const covReqs = covRes.data ?? [];
        const storeShifts = (shiftsRes.data ?? []) as ShiftRow[];
        const shiftsByDate = new Map<string, ShiftRow[]>();
        storeShifts.filter(s => !s.is_day_off && s.start_time && s.end_time).forEach(s => {
          const arr = shiftsByDate.get(s.date) ?? [];
          arr.push(s);
          shiftsByDate.set(s.date, arr);
        });

        for (let d = 1; d <= lastDay; d++) {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dow = (new Date(dateStr + "T00:00:00").getDay() + 6) % 7;
          const dayCov = covReqs.filter(c => c.day_of_week === dow);
          const dayShifts = shiftsByDate.get(dateStr) ?? [];

          for (const cov of dayCov) {
            const h = parseInt(String(cov.hour_slot).split(":")[0], 10);
            let staffCount = 0;
            for (const s of dayShifts) {
              const sh = parseInt(s.start_time!.split(":")[0], 10);
              let eh = parseInt(s.end_time!.split(":")[0], 10);
              if (eh === 0) eh = 24;
              if (h >= sh && h < eh) staffCount++;
            }
            if (staffCount < cov.min_staff_required) {
              shortages.push({
                storeId: store.id,
                storeName: store.name,
                dateStr,
                hour: h,
                deficit: cov.min_staff_required - staffCount,
              });
            }
          }
        }
      }
      return shortages;
    },
    enabled: !!storeId,
    staleTime: 60_000,
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
 * Generates actionable suggestion cards with cross-store lending priority.
 * 
 * Priority for surplus:
 * 1. If another store has a shortage at same time → Lending suggestion
 * 2. If no lending possible and employee has high hour_balance → Hour reduction
 * 3. If no lending and employee meets min hours → Shift removal
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
  crossStoreShortages?: StoreShortage[],
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

    // Index cross-store shortages by date+hour for fast lookup
    const shortageIndex = new Map<string, StoreShortage[]>();
    (crossStoreShortages ?? []).forEach(sh => {
      const key = `${sh.dateStr}-${sh.hour}`;
      const arr = shortageIndex.get(key) ?? [];
      arr.push(sh);
      shortageIndex.set(key, arr);
    });

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

        // Uncovered → critical, no manual edit, just navigate
        if (staffCount < cov.min_staff_required) {
          suggestions.push({
            id: `uncov-${dateStr}-${h}`,
            type: "uncovered",
            severity: "critical",
            title: `Copertura mancante ${dayLabel} ore ${h}:00`,
            description: `Servono ${cov.min_staff_required} persone, assegnate ${staffCount}. Assegnazione necessaria.`,
            actionLabel: "Vai al giorno",
            declineLabel: "Ignora",
            date: dateStr,
          });
        }

        // Surplus → prioritize lending, then hour bank, then removal
        if (staffCount > cov.min_staff_required + 1) {
          const excess = staffCount - cov.min_staff_required;
          
          // Pick the employee with highest hour_balance for lending/reduction
          const rankedShifts = [...coveringShifts].sort((a, b) => {
            const balA = balMap.get(a.user_id) ?? 0;
            const balB = balMap.get(b.user_id) ?? 0;
            return balB - balA; // highest balance first
          });
          const candidateShift = rankedShifts[0];
          const empName = empMap.get(candidateShift.user_id)?.full_name ?? "Dipendente";
          const empBalance = balMap.get(candidateShift.user_id) ?? 0;

          // Check if any other store needs staff at same date+hour
          const shortageKey = `${dateStr}-${h}`;
          const matchingShortages = shortageIndex.get(shortageKey) ?? [];

          if (matchingShortages.length > 0) {
            // PRIORITY 1: Cross-Store Lending
            const target = matchingShortages[0];
            suggestions.push({
              id: `lending-${dateStr}-${h}-${candidateShift.id}`,
              type: "lending",
              severity: "warning",
              title: `Prestito ${dayLabel} ore ${h}:00`,
              description: `Surplus qui (${staffCount}/${cov.min_staff_required}), carenza a ${target.storeName}. Spostare ${empName} a ${target.storeName}?`,
              actionLabel: "Applica Prestito",
              declineLabel: "Ignora",
              shiftId: candidateShift.id,
              userId: candidateShift.user_id,
              userName: empName,
              date: dateStr,
              targetStoreId: target.storeId,
              targetStoreName: target.storeName,
              sourceStoreId: candidateShift.store_id,
              slot: `${h}:00`,
            });
          } else if (empBalance > 0) {
            // PRIORITY 2: Hour Bank Reduction (employee has worked too much)
            const reductionHours = Math.min(empBalance, 2);
            suggestions.push({
              id: `hourreduce-${dateStr}-${h}-${candidateShift.id}`,
              type: "hour_reduction",
              severity: "info",
              title: `Riduci ore ${empName} ${dayLabel}`,
              description: `Surplus (${staffCount}/${cov.min_staff_required}). ${empName} ha +${empBalance}h nel monte ore. Ridurre di ${reductionHours}h.`,
              actionLabel: "Applica Riduzione",
              declineLabel: "Ignora",
              shiftId: candidateShift.id,
              userId: candidateShift.user_id,
              userName: empName,
              date: dateStr,
              suggestedHours: reductionHours,
            });
          } else {
            // PRIORITY 3: Shift Removal (last resort)
            suggestions.push({
              id: `surplus-${dateStr}-${h}`,
              type: "surplus",
              severity: "warning",
              title: `Surplus ${dayLabel} ore ${h}:00`,
              description: `Troppe persone (${staffCount}/${cov.min_staff_required}). Rimuovere il turno di ${empName}?`,
              actionLabel: "Rimuovi Turno",
              declineLabel: "Ignora",
              shiftId: candidateShift.id,
              userId: candidateShift.user_id,
              userName: empName,
              date: dateStr,
            });
          }
        }
      }
    }

    // Overtime balance suggestions (independent of surplus)
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
            ? `Ha accumulato +${absBalance}h. Ridurre di ${Math.min(absBalance, 2)}h questa settimana.`
            : `Ha un deficit di ${absBalance}h. Aumentare le ore questa settimana.`,
          actionLabel: balance > 0 ? "Applica Riduzione" : "Applica Aumento",
          declineLabel: "Ignora",
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
  }, [shifts, department, coverageReqs, employees, balances, year, month, hasDraft, crossStoreShortages]);
}
