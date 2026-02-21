import { Calendar } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const PersonalCalendar = () => (
  <div>
    <PageHeader
      title="Calendario Personale"
      subtitle="I tuoi turni e la tua pianificazione settimanale"
    />
    <EmptyState
      icon={<Calendar className="h-6 w-6" />}
      title="Nessun turno assegnato"
      description="Qui vedrai i tuoi turni personali una volta che saranno stati generati."
    />
  </div>
);

export default PersonalCalendar;
