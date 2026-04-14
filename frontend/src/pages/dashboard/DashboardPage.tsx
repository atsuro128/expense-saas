// ダッシュボードページコンポーネント。
// ロール別にセクションを出し分ける。
// 55_ui_component/screens/dashboard.md §DashboardPage 準拠。

import Grid from '@mui/material/Grid2';
import { useDashboard } from '../../hooks/useDashboard';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import PageSkeleton from '../../components/ui/PageSkeleton';
import AppToast from '../../components/ui/AppToast';
import CountCard from '../../components/dashboard/CountCard';
import MyReportCountCards from '../../components/dashboard/MyReportCountCards';
import TenantStatusCards from '../../components/dashboard/TenantStatusCards';
import MonthlySummaryTable from '../../components/dashboard/MonthlySummaryTable';
import RecentReportList from '../../components/dashboard/RecentReportList';
import type { MonthlySummaryItem } from '../../components/dashboard/MonthlySummaryTable';
import type { RecentReport } from '../../components/dashboard/RecentReportList';

/**
 * DashboardPage はダッシュボード画面のルートコンポーネント。
 * useDashboard でデータを取得し、useCurrentUser でロールを判定して
 * ロール別にセクションを出し分ける。
 */
export default function DashboardPage() {
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboard();
  const { data: userData, isLoading: userLoading } = useCurrentUser();

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
      {/* Member / Approver / Accounting: 自分のレポートカード */}
      {isMemberLike && (
        <MyReportCountCards
          draftCount={dashboard.my_draft_count ?? 0}
          submittedCount={dashboard.my_submitted_count ?? 0}
          rejectedCount={dashboard.my_rejected_count ?? 0}
        />
      )}

      {/* Approver: 承認待ちカード。MyReportCountCards と同じ Grid レイアウト・余白で配置する */}
      {isApprover && (
        <Grid container spacing={2} data-testid="approver-action-cards">
          <Grid size={{ xs: 12, sm: 4 }}>
            <CountCard
              label="承認待ち"
              count={dashboard.pending_approval_count ?? 0}
              showBadge={true}
              href="/approvals"
              accentColor="info"
            />
          </Grid>
        </Grid>
      )}

      {/* Accounting: 支払待ちカード。MyReportCountCards と同じ Grid レイアウト・余白で配置する */}
      {isAccounting && (
        <Grid container spacing={2} data-testid="accounting-action-cards">
          <Grid size={{ xs: 12, sm: 4 }}>
            <CountCard
              label="支払待ち"
              count={dashboard.pending_payment_count ?? 0}
              showBadge={true}
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
          <CountCard
            label="メンバー数"
            count={dashboard.tenant_member_count ?? 0}
            unit="人"
          />
        </>
      )}

      {/* Approver / Accounting / Admin: 月別サマリー */}
      {isApproverOrAccountingOrAdmin && (
        <MonthlySummaryTable items={monthlySummaryItems} />
      )}

      {/* Member / Approver / Accounting: 最近のレポート一覧 */}
      {isMemberLike && (
        <RecentReportList reports={recentReports} />
      )}
    </div>
  );
}
