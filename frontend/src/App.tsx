// アプリケーションルートコンポーネント。
// BrowserRouter + Routes でルーティングを定義する。
// 認証必須ルートは PrivateRoute（認証ガード）+ AppLayoutOutlet（共通レイアウト）でラップする。
// PrivateRoute: 未ログイン時に /login にリダイレクト（SMK-008 の return_to 要件）。
// AppLayoutOutlet: AppHeader + AppSidebar を全認証済み画面に統一適用する。

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/auth/PrivateRoute';
import AppLayoutOutlet from './components/layout/AppLayoutOutlet';
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
import AllReportsPage from './pages/admin/AllReportsPage';
import TenantPage from './pages/admin/TenantPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 認証不要ルート */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/password-reset" element={<PasswordResetRequestPage />} />
        <Route path="/password-reset/:token" element={<PasswordResetPage />} />

        {/* 認証必須ルート: PrivateRoute で未ログインを弾き、AppLayoutOutlet で共通レイアウトを適用する */}
        <Route element={<PrivateRoute />}>
          <Route element={<AppLayoutOutlet />}>
            {/* screens.md §3.2: SCR-DASH-001 = /dashboard。ルートは /dashboard にリダイレクト */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/reports" element={<ReportListPage />} />
            <Route path="/reports/new" element={<ReportCreatePage />} />
            {/* SCR-ADM-001: 管理者向け全レポート一覧。:id より前に配置して all がパラメータにマッチしないようにする */}
            <Route path="/reports/all" element={<AllReportsPage />} />
            <Route path="/reports/:id" element={<ReportDetailPage />} />
            <Route path="/reports/:id/edit" element={<ReportEditPage />} />
            <Route path="/approvals" element={<ApprovalListPage />} />
            <Route path="/payments" element={<PaymentListPage />} />
            {/* SCR-ADM-002: テナント設定画面 */}
            <Route path="/settings/tenant" element={<TenantPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
