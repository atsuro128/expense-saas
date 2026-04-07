import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ReportListPage from './pages/ReportListPage';
import ReportDetailPage from './pages/ReportDetailPage';
import ReportCreatePage from './pages/ReportCreatePage';
import ReportEditPage from './pages/ReportEditPage';
import ApprovalListPage from './pages/ApprovalListPage';
import PaymentListPage from './pages/PaymentListPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
