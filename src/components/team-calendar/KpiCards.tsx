import { Palmtree, Clock, Hourglass, Thermometer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ShiftRow } from "@/hooks/useShifts";

interface KpiCardsProps {
  shifts: ShiftRow[];
  employeeCount: number;
  year: number;
  month: number;
}

export function KpiCards({ shifts, employeeCount, year, month }: KpiCardsProps) {
  // Mock/placeholder KPIs - ready for real data when tables exist
  const totalDaysOff = shifts.filter((s) => s.is_day_off).length;
  const totalShifts = shifts.filter((s) => !s.is_day_off).length;

  // Calculate covered hours
  const coveredHours = shifts
    .filter((s) => !s.is_day_off && s.start_time && s.end_time)
    .reduce((sum, s) => {
      const [sh] = (s.start_time ?? "0").split(":").map(Number);
      const [eh] = (s.end_time ?? "0").split(":").map(Number);
      const end = eh === 0 ? 24 : eh;
      return sum + Math.max(0, end - sh);
    }, 0);

  const cards = [
    {
      icon: Palmtree,
      label: "Ferie / Riposi",
      value: `${totalDaysOff}`,
      sub: "nel mese",
      color: "text-emerald-600 bg-emerald-500/10",
    },
    {
      icon: Clock,
      label: "Turni assegnati",
      value: `${totalShifts}`,
      sub: `su ${employeeCount} dipendenti`,
      color: "text-primary bg-primary/10",
    },
    {
      icon: Hourglass,
      label: "Ore coperte",
      value: `${coveredHours}h`,
      sub: "totale mese",
      color: "text-amber-600 bg-amber-500/10",
    },
    {
      icon: Thermometer,
      label: "Malattie",
      value: "0",
      sub: "questo mese",
      color: "text-rose-600 bg-rose-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map((c) => (
        <Card key={c.label} className="border-white/40 shadow-sm transition-all duration-200 hover:scale-[1.01]">
          <CardContent className="p-4 flex items-start gap-3">
            <div className={`rounded-lg p-2 ${c.color}`}>
              <c.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{c.label}</p>
              <p className="text-lg font-bold text-foreground leading-tight">{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
