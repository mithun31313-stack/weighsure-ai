import { Navigate, Route, Routes } from "react-router-dom";
import { type ReactNode } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { LangProvider } from "./lib/lang";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Instruments } from "./pages/Instruments";
import { Tests } from "./pages/Tests";
import { NewTest } from "./pages/NewTest";
import { TestDetail } from "./pages/TestDetail";
import { Reports } from "./pages/Reports";
import { Calibrations } from "./pages/Calibrations";
import { Analytics } from "./pages/Analytics";
import { AuditTrail } from "./pages/AuditTrail";
import { Settings } from "./pages/Settings";
import { Verify } from "./pages/Verify";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-steel">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/verify/:reportId" element={<Verify />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/instruments" element={<Protected><Instruments /></Protected>} />
      <Route path="/tests" element={<Protected><Tests /></Protected>} />
      <Route path="/tests/new" element={<Protected><NewTest /></Protected>} />
      <Route path="/tests/:id" element={<Protected><TestDetail /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/calibrations" element={<Protected><Calibrations /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/audit" element={<Protected><AuditTrail /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </LangProvider>
  );
}

export default App;
