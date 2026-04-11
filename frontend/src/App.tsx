import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/login/LoginPage';
import SignupPage from './pages/signup/SignupPage';
import PasswordResetRequestPage from './pages/password-reset/PasswordResetRequestPage';
import PasswordResetPage from './pages/password-reset/PasswordResetPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ReportListPage from './pages/reports/ReportListPage';
import ReportDetailPage from './pages/reports/ReportDetailPage';
import ReportCreatePage from './pages/reports/ReportCreatePage';
import ReportEditPage from './pages/reports/ReportEditPage';
import ApprovalListPage from './pages/workflow/ApprovalListPage';
import PaymentListPage from './pages/workflow/PaymentListPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/password-reset" element={<PasswordResetRequestPage />} />
        <Route path="/password-reset/:token" element={<PasswordResetPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        {/* screens.md §3.2: SCR-DASH-001 = /dashboard。ルートは /dashboard にリダイレクト */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/reports" element={<ReportListPage />} />
        <Route path="/reports/new" element={<ReportCreatePage />} />
        <Route path="/reports/:id" element={<ReportDetailPage />} />
        <Route path="/reports/:id/edit" element={<ReportEditPage />} />
        <Route path="/approvals" element={<ApprovalListPage />} />
        <Route path="/payments" element={<PaymentListPage />} />
      </Routes>
    </BrowserRouter>
  );
}
