import { CalendarDays } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const TeamCalendar = () => (
  <div>
    <PageHeader
      title="Calendario Team"
      subtitle="Visualizza i turni di tutto il team dello store selezionato"
    />
    <EmptyState
      icon={<CalendarDays className="h-6 w-6" />}
      title="Nessun turno programmato"
      description="I turni del team verranno mostrati qui dopo la prima generazione automatica."
    />
  </div>
);

export default TeamCalendar;
