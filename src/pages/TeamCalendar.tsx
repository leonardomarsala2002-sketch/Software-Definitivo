import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMonthShifts, useCreateShift, useUpdateShift, useDeleteShift } from "@/hooks/useShifts";
import { useEmployeeList } from "@/hooks/useEmployees";
import { useOpeningHours, useAllowedTimes } from "@/hooks/useStoreSettings";
import { KpiCards } from "@/components/team-calendar/KpiCards";
import { MonthGrid } from "@/components/team-calendar/MonthGrid";
import { DayDetailDialog } from "@/components/team-calendar/DayDetailDialog";
import EmptyState from "@/components/EmptyState";

const TeamCalendar = () => {
  const { activeStore, role } = useAuth();
  const storeId = activeStore?.id;
  const canEdit = role === "super_admin" || role === "admin";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [department, setDepartment] = useState<"sala" | "cucina">("sala");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: shifts = [], isLoading: loadingShifts } = useMonthShifts(storeId, year, month);
  const { data: allEmployees = [], isLoading: loadingEmp } = useEmployeeList();
  const { data: openingHours = [] } = useOpeningHours(storeId);
  const { data: allowedTimes = [] } = useAllowedTimes(storeId);

  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  // Filter employees by department and active store
  const employees = useMemo(() => {
    return allEmployees
      .filter((e) => e.department === department && e.is_active && e.primary_store_id === storeId)
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [allEmployees, department, storeId]);

  const allowedEntries = useMemo(
    () =>
      allowedTimes
        .filter((t) => t.department === department && t.kind === "entry" && t.is_active)
        .map((t) => t.hour)
        .sort((a, b) => a - b),
    [allowedTimes, department]
  );

  const allowedExits = useMemo(
    () =>
      allowedTimes
        .filter((t) => t.department === department && t.kind === "exit" && t.is_active)
        .map((t) => t.hour)
        .sort((a, b) => a - b),
    [allowedTimes, department]
  );

  // Month navigation
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

  // Week count
  const firstDay = new Date(year, month - 1, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalWeeks = Math.ceil((startDow + daysInMonth) / 7);

  const isLoading = loadingShifts || loadingEmp;

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
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : (
        <>
          <KpiCards
            shifts={shifts}
            employeeCount={employees.length}
            year={year}
            month={month}
          />

          <MonthGrid
            year={year}
            month={month}
            shifts={shifts}
            employees={employees}
            department={department}
            selectedWeek={selectedWeek}
            onDayClick={(date) => setSelectedDate(date)}
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
                createShift.mutate({
                  store_id: storeId!,
                  department,
                  ...s,
                })
              }
              onUpdateShift={(id, updates) => updateShift.mutate({ id, updates })}
              onDeleteShift={(id) => deleteShift.mutate(id)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default TeamCalendar;
