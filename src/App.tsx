import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleRoute } from "@/components/RoleRoute";
import { AppShell } from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import TeamCalendar from "@/pages/TeamCalendar";
import AdminShiftsViewer from "@/pages/AdminShiftsViewer";
import PersonalCalendar from "@/pages/PersonalCalendar";
import Requests from "@/pages/Requests";
import Employees from "@/pages/Employees";
import StoreSettings from "@/pages/StoreSettings";
import AuditLog from "@/pages/AuditLog";
import Invitations from "@/pages/Invitations";
import Info from "@/pages/Info";
import ManageStores from "@/pages/ManageStores";
import Login from "@/pages/Login";
import AcceptInvite from "@/pages/AcceptInvite";
import SetPassword from "@/pages/SetPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import AIAssistant from "@/pages/AIAssistant";
import SchedulerView from "@/pages/SchedulerView";
import SettingsView from "@/pages/SettingsView";
import EmployeeProfile from "@/pages/EmployeeProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster richColors position="top-right" />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/invite" element={<AcceptInvite />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Dashboard />} />
                {/* Tutti i ruoli autenticati */}
                <Route path="/requests" element={<Requests />} />
                <Route path="/info" element={<Info />} />
                {/* Solo employee */}
                <Route path="/personal-calendar" element={<RoleRoute roles={["employee"]}><PersonalCalendar /></RoleRoute>} />
                <Route path="/profile" element={<RoleRoute roles={["employee"]}><EmployeeProfile /></RoleRoute>} />
                {/* Admin, Manager, SuperAdmin */}
                <Route path="/team-calendar" element={<RoleRoute roles={["admin", "store_manager", "super_admin", "employee"]}><TeamCalendar /></RoleRoute>} />
                <Route path="/scheduler" element={<RoleRoute roles={["admin", "store_manager", "super_admin"]}><SchedulerView /></RoleRoute>} />
                <Route path="/employees" element={<RoleRoute roles={["super_admin", "admin", "store_manager"]}><Employees /></RoleRoute>} />
                <Route path="/store-settings" element={<RoleRoute roles={["super_admin", "admin", "store_manager"]}><StoreSettings /></RoleRoute>} />
                <Route path="/audit-log" element={<RoleRoute roles={["super_admin", "admin", "store_manager"]}><AuditLog /></RoleRoute>} />
                <Route path="/settings" element={<RoleRoute roles={["super_admin", "admin", "store_manager"]}><SettingsView /></RoleRoute>} />
                <Route path="/ai-assistant" element={<RoleRoute roles={["admin", "store_manager"]}><AIAssistant /></RoleRoute>} />
                {/* Solo SuperAdmin */}
                <Route path="/admin-shifts" element={<RoleRoute roles={["super_admin"]}><AdminShiftsViewer /></RoleRoute>} />
                <Route path="/invitations" element={<RoleRoute roles={["super_admin"]}><Invitations /></RoleRoute>} />
                <Route path="/manage-stores" element={<RoleRoute roles={["super_admin"]}><ManageStores /></RoleRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
