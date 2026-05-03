// ダッシュボードページコンポーネント。
// ロール別にセクションを出し分ける。
// 55_ui_component/screens/dashboard.md §DashboardPage 準拠。
// navigate state 経由で遷移先トーストを受信する（issue 088: 403 認可エラー UX）。

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import { useDashboard } from '../../hooks/useDashboard';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import PageSkeleton from '../../components/ui/PageSkeleton';
import AppToast from '../../components/ui/AppToast';
import type { ToastSeverity } from '../../components/ui/AppToast';
import CountCard from '../../components/dashboard/CountCard';
import MyReportCountCards from '../../components/dashboard/MyReportCountCards';
import TenantStatusCards from '../../components/dashboard/TenantStatusCards';
import MonthlySummaryTable from '../../components/dashboard/MonthlySummaryTable';
import RecentReportList from '../../components/dashboard/RecentReportList';
import type { MonthlySummaryItem } from '../../components/dashboard/MonthlySummaryTable';
import type { RecentReport } from '../../components/dashboard/RecentReportList';

/** navigate state 経由で受け取るトースト情報の型 */
interface ToastState {
  open: boolean;
  message: string;
  severity: ToastSeverity;
}

/**
 * DashboardPage はダッシュボード画面のルートコンポーネント。
 * useDashboard でデータを取得し、useCurrentUser でロールを判定して
 * ロール別にセクションを出し分ける。
 */
export default function DashboardPage() {
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboard();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const location = useLocation();

  // navigate state 経由で渡されたトースト情報を受信する（issue 088: 403 認可エラー UX）。
  const [redirectToast, setRedirectToast] = useState<ToastState>({
    open: false,
    message: '',
    severity: 'info',
  });

  useEffect(() => {
    const locationState = location.state as { toast?: { severity: ToastSeverity; message: string } } | null;
    if (locationState?.toast) {
      setRedirectToast({ ...locationState.toast, open: true });
      // 履歴リロード時の再発火を防ぐためにステートをクリアする。
      window.history.replaceState({}, '');
    }
  }, [location]);

  if (dashboardLoading || userLoading) {
    return <PageSkeleton variant="card" />;
  }

  if (dashboardError) {
    return (
      <AppToast
        open={true}
        severity="error"
        message={dashboardError.message}
        onClose={() => {}}
      />
    );
  }

  const role = userData?.data?.role;
  const dashboard = dashboardData?.data;

  if (!dashboard || !role) {
    return null;
  }

  const isAdmin = role === 'admin';
  // Member 単独（Approver / Accounting は専用ブロックで処理するため除外）。
  const isMemberOnly = role === 'member';
  const isMemberLike = role === 'member' || role === 'approver' || role === 'accounting';
  const isApprover = role === 'approver';
  const isAccounting = role === 'accounting';
  const isApproverOrAccountingOrAdmin = role === 'approver' || role === 'accounting' || role === 'admin';

  // monthly_summary を MonthlySummaryItem[] に変換する。
  const monthlySummaryItems: MonthlySummaryItem[] = (dashboard.monthly_summary ?? []).map((s) => ({
    yearMonth: s.year_month,
    totalAmount: s.total_amount,
  }));

  // recent_reports を RecentReport[] に変換する。
  const recentReports: RecentReport[] = (dashboard.recent_reports ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    totalAmount: r.total_amount,
    status: r.status as RecentReport['status'],
  }));

  return (
    <div>
      {/* 認可エラーによるリダイレクト時のトースト（issue 088: 403 認可エラー UX）。*/}
      <AppToast
        open={redirectToast.open}
        severity={redirectToast.severity}
        message={redirectToast.message}
        onClose={() => setRedirectToast((prev) => ({ ...prev, open: false }))}
      />

      {/* Member 単独: 自分のレポートカード 3 枚を単一 Grid に配置する（issue #169）。*/}
      {isMemberOnly && (
        <Grid container spacing={2} data-testid="my-report-count-cards">
          <MyReportCountCards
            draftCount={dashboard.my_draft_count ?? 0}
            submittedCount={dashboard.my_submitted_count ?? 0}
            rejectedCount={dashboard.my_rejected_count ?? 0}
          />
        </Grid>
      )}

      {/* Approver: MyReportCountCards 3 枚 + 承認待ち 1 枚 = 計 4 枚を単一 Grid に配置する（issue #169）。
          Admin と同様に spacing={2} (16px) の行間で 3+1 折り返しレイアウトを実現する。 */}
      {isApprover && (
        <Grid container spacing={2} data-testid="approver-cards-row">
          <MyReportCountCards
            draftCount={dashboard.my_draft_count ?? 0}
            submittedCount={dashboard.my_submitted_count ?? 0}
            rejectedCount={dashboard.my_rejected_count ?? 0}
          />
          <Grid size={{ xs: 12, sm: 4 }}>
            <CountCard
              label="承認待ち"
              count={dashboard.pending_approval_count ?? 0}
              href="/approvals"
              accentColor="info"
            />
          </Grid>
        </Grid>
      )}

      {/* Accounting: MyReportCountCards 3 枚 + 支払待ち 1 枚 = 計 4 枚を単一 Grid に配置する（issue #169）。
          Admin と同様に spacing={2} (16px) の行間で 3+1 折り返しレイアウトを実現する。 */}
      {isAccounting && (
        <Grid container spacing={2} data-testid="accounting-cards-row">
          <MyReportCountCards
            draftCount={dashboard.my_draft_count ?? 0}
            submittedCount={dashboard.my_submitted_count ?? 0}
            rejectedCount={dashboard.my_rejected_count ?? 0}
          />
          <Grid size={{ xs: 12, sm: 4 }}>
            <CountCard
              label="支払待ち"
              count={dashboard.pending_payment_count ?? 0}
              href="/payments"
              accentColor="success"
            />
          </Grid>
        </Grid>
      )}

      {/* Admin: テナント全体ステータスカード + メンバー数 */}
      {isAdmin && (
        <>
          <TenantStatusCards
            draftCount={dashboard.tenant_draft_count ?? 0}
            submittedCount={dashboard.tenant_submitted_count ?? 0}
            approvedCount={dashboard.tenant_approved_count ?? 0}
            rejectedCount={dashboard.tenant_rejected_count ?? 0}
            paidCount={dashboard.tenant_paid_count ?? 0}
          />
          {/* メンバー数カードを Grid でラップし、他ロール（MyReportCountCards）と同じ 1/3 幅基準に揃える。 */}
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2} data-testid="admin-member-count-cards">
              <Grid size={{ xs: 12, sm: 4 }}>
                <CountCard
                  label="メンバー数"
                  count={dashboard.tenant_member_count ?? 0}
                  unit="人"
                />
              </Grid>
            </Grid>
          </Box>
        </>
      )}

      {/* Approver / Accounting / Admin: 月別サマリー */}
      {isApproverOrAccountingOrAdmin && (
        <Box sx={{ mt: 3 }}>
          <MonthlySummaryTable items={monthlySummaryItems} />
        </Box>
      )}

      {/* Member / Approver / Accounting: 最近のレポート一覧 */}
      {isMemberLike && (
        <Box sx={{ mt: 3 }}>
          <RecentReportList reports={recentReports} />
        </Box>
      )}
    </div>
  );
}
