import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import TeamCalendar from "@/pages/TeamCalendar";
import PersonalCalendar from "@/pages/PersonalCalendar";
import Requests from "@/pages/Requests";
import Employees from "@/pages/Employees";
import StoreSettings from "@/pages/StoreSettings";
import AuditLog from "@/pages/AuditLog";
import Invitations from "@/pages/Invitations";
import Info from "@/pages/Info";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/team-calendar" element={<TeamCalendar />} />
              <Route path="/personal-calendar" element={<PersonalCalendar />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/store-settings" element={<StoreSettings />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/invitations" element={<Invitations />} />
              <Route path="/info" element={<Info />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
