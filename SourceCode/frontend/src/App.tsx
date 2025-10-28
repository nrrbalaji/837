import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Claims from "./pages/Claims";
import ClaimDetail from "./pages/ClaimDetail";
import Upload from "./pages/Upload";
import UploadHistory from "./pages/UploadHistory";
import ParsedJsonHistory from "./pages/ParsedJsonHistory";
import Rules from "./pages/Rules";
import AddEditRule from "./pages/AddEditRule";
import TestRulePage from "./pages/TestRulePage";
import ValidationLogs from "./pages/ValidationLogs";
import ManualCorrection from "./pages/ManualCorrectionEnhanced";
import ProviderProfileMaster from "./pages/ProviderProfileMaster";
import FacilityMaster from "./pages/FacilityMaster";
import PayerMaster from "./pages/PayerMaster";
import TradingPartnerMaster from "./pages/TradingPartnerMaster";
import ClaimHistory from "./pages/ClaimHistory";
import UserManagement from "./pages/UserManagement";
import NotFound from "./pages/NotFound";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="claims" element={<Claims />} />
            <Route path="claims/:id" element={<ClaimDetail />} />
            <Route path="upload" element={<Upload />} />
            <Route path="upload/history" element={<UploadHistory />} />
            <Route path="claim-history/:fileId" element={<ClaimHistory />} />
            <Route path="parsed-json-history" element={<ParsedJsonHistory />} />
            <Route path="rules" element={<Rules />} />
            <Route path="rules/add" element={<AddEditRule />} />
            <Route path="rules/edit/:id" element={<AddEditRule />} />
            <Route path="rules/test" element={<TestRulePage />} />
            <Route path="validation-logs" element={<ValidationLogs />} />
            <Route path="manual-correction" element={<ManualCorrection />} />
            <Route path="providers" element={<ProviderProfileMaster />} />
            <Route path="facilities" element={<FacilityMaster />} />
            <Route path="payers" element={<PayerMaster />} />
            <Route path="trading-partners" element={<TradingPartnerMaster />} />
            <Route path="user-management" element={<UserManagement />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
