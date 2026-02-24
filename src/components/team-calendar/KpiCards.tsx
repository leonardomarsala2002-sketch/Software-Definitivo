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
  const totalDaysOff = shifts.filter((s) => s.is_day_off).length;
  const totalShifts = shifts.filter((s) => !s.is_day_off).length;

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
      iconColor: "text-[#00C853]",
    },
    {
      icon: Clock,
      label: "Turni assegnati",
      value: `${totalShifts}`,
      sub: `su ${employeeCount} dipendenti`,
      iconColor: "text-[#2962FF]",
    },
    {
      icon: Hourglass,
      label: "Ore coperte",
      value: `${coveredHours}h`,
      sub: "totale mese",
      iconColor: "text-[#00C853]",
    },
    {
      icon: Thermometer,
      label: "Malattie",
      value: "0",
      sub: "questo mese",
      iconColor: "text-[#FF3D00]",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="rounded-xl p-2 bg-accent">
              <c.icon className={`h-4 w-4 ${c.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#444] truncate">{c.label}</p>
              <p className="text-lg font-bold text-[#111] leading-tight">{c.value}</p>
              <p className="text-[10px] text-[#666]">{c.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
