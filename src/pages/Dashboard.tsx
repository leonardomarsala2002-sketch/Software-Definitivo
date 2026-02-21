import { LayoutDashboard } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const Dashboard = () => (
  <div>
    <PageHeader
      title="Dashboard"
      subtitle="Panoramica generale di tutti gli store e del team"
    />
    <EmptyState
      icon={<LayoutDashboard className="h-6 w-6" />}
      title="Nessun dato ancora"
      description="I dati della dashboard appariranno qui una volta configurati gli store e i dipendenti."
    />
  </div>
);

export default Dashboard;
