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
import AddEditProvider from "./pages/AddEditProvider";
import ViewProvider from "./pages/ViewProvider";
import FacilityMaster from "./pages/FacilityMaster";
import AddEditFacility from "./pages/AddEditFacility";
import ViewFacility from "./pages/ViewFacility";
import PayerMaster from "./pages/PayerMaster";
import AddEditPayer from "./pages/AddEditPayer";
import ViewPayer from "./pages/ViewPayer";
import TradingPartnerMaster from "./pages/TradingPartnerMaster";
import AddEditTradingPartner from "./pages/AddEditTradingPartner";
import ViewTradingPartner from "./pages/ViewTradingPartner";
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
            <Route path="providers/add" element={<AddEditProvider />} />
            <Route path="providers/edit/:id" element={<AddEditProvider />} />
            <Route path="providers/view/:id" element={<ViewProvider />} />
            <Route path="facilities" element={<FacilityMaster />} />
            <Route path="facilities/add" element={<AddEditFacility />} />
            <Route path="facilities/edit/:id" element={<AddEditFacility />} />
            <Route path="facilities/view/:id" element={<ViewFacility />} />
            <Route path="payers" element={<PayerMaster />} />
            <Route path="payers/add" element={<AddEditPayer />} />
            <Route path="payers/edit/:id" element={<AddEditPayer />} />
            <Route path="payers/view/:id" element={<ViewPayer />} />
            <Route path="trading-partners" element={<TradingPartnerMaster />} />
            <Route path="trading-partners/add" element={<AddEditTradingPartner />} />
            <Route path="trading-partners/edit/:id" element={<AddEditTradingPartner />} />
            <Route path="trading-partners/view/:id" element={<ViewTradingPartner />} />
            <Route path="user-management" element={<UserManagement />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
