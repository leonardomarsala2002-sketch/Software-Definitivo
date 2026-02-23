import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import TeamCalendar from "@/pages/TeamCalendar";
import Requests from "@/pages/Requests";
import Employees from "@/pages/Employees";
import StoreSettings from "@/pages/StoreSettings";
import Login from "@/pages/Login";
import AcceptInvite from "@/pages/AcceptInvite";
import SetPassword from "@/pages/SetPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

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
                <Route path="/team-calendar" element={<TeamCalendar />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/store-settings" element={<StoreSettings />} />
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
