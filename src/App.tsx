import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import TeamCalendar from "@/pages/TeamCalendar";
import PersonalCalendar from "@/pages/PersonalCalendar";
import Requests from "@/pages/Requests";
import Employees from "@/pages/Employees";
import StoreSettings from "@/pages/StoreSettings";
import AuditLog from "@/pages/AuditLog";
import Info from "@/pages/Info";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/team-calendar" element={<TeamCalendar />} />
            <Route path="/personal-calendar" element={<PersonalCalendar />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/store-settings" element={<StoreSettings />} />
            <Route path="/audit-log" element={<AuditLog />} />
            <Route path="/info" element={<Info />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
