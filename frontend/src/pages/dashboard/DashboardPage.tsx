// ダッシュボード画面コンポーネント。
// ロール別にダッシュボードの表示内容を切り替える。
// screens.md §SCR-DSH-001 準拠。

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import { useDashboard } from '../../hooks/useDashboard';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import CountCard from '../../components/dashboard/CountCard';
import MyReportCountCards from '../../components/dashboard/MyReportCountCards';
import TenantStatusCards from '../../components/dashboard/TenantStatusCards';
import MonthlySummaryTable from '../../components/dashboard/MonthlySummaryTable';
import RecentReportList from '../../components/dashboard/RecentReportList';
import PageSkeleton from '../../components/ui/PageSkeleton';

/**
 * DashboardPage はダッシュボード画面を表示するページコンポーネント。
 * ユーザーのロールに応じて表示内容を切り替える。
 */
export default function DashboardPage() {
  const { data: dashboardData, isLoading, error } = useDashboard();
  const { data: currentUserData } = useCurrentUser();

  // ローディング中はスケルトンを表示する。
  if (isLoading) {
    return <PageSkeleton variant="card" />;
  }

  // エラー発生時はエラーメッセージを表示する。
  if (error) {
    return <Box>{error.message}</Box>;
  }

  const role = currentUserData?.data?.role;
  const dashboard = dashboardData?.data;

  // 月別サマリーデータを camelCase にマッピングする。
  const monthlySummaryItems = (dashboard?.monthly_summary ?? []).map((s) => ({
    yearMonth: s.year_month,
    totalAmount: s.total_amount,
  }));

  // 直近レポートデータを camelCase にマッピングする。
  const recentReports = (dashboard?.recent_reports ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    totalAmount: r.total_amount,
    status: r.status,
  }));

  // Admin ロール: TenantStatusCards + メンバー数カード + MonthlySummaryTable を表示する。
  if (role === 'admin') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TenantStatusCards
          draftCount={dashboard?.tenant_draft_count ?? 0}
          submittedCount={dashboard?.tenant_submitted_count ?? 0}
          approvedCount={dashboard?.tenant_approved_count ?? 0}
          rejectedCount={dashboard?.tenant_rejected_count ?? 0}
          paidCount={dashboard?.tenant_paid_count ?? 0}
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <CountCard
              label="メンバー数"
              count={dashboard?.tenant_member_count ?? 0}
              unit="人"
            />
          </Grid>
        </Grid>
        <MonthlySummaryTable items={monthlySummaryItems} />
      </Box>
    );
  }

  // Approver ロール: MyReportCountCards + 承認待ちカード + MonthlySummaryTable + RecentReportList を表示する。
  if (role === 'approver') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <MyReportCountCards
          draftCount={dashboard?.my_draft_count ?? 0}
          submittedCount={dashboard?.my_submitted_count ?? 0}
          rejectedCount={dashboard?.my_rejected_count ?? 0}
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <CountCard
              label="承認待ち"
              count={dashboard?.pending_approval_count ?? 0}
              href="/approvals"
              showBadge
            />
          </Grid>
        </Grid>
        <MonthlySummaryTable items={monthlySummaryItems} />
        <RecentReportList reports={recentReports} />
      </Box>
    );
  }

  // Accounting ロール: MyReportCountCards + 支払待ちカード + MonthlySummaryTable + RecentReportList を表示する。
  if (role === 'accounting') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <MyReportCountCards
          draftCount={dashboard?.my_draft_count ?? 0}
          submittedCount={dashboard?.my_submitted_count ?? 0}
          rejectedCount={dashboard?.my_rejected_count ?? 0}
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <CountCard
              label="支払待ち"
              count={dashboard?.pending_payment_count ?? 0}
              href="/payments"
              showBadge
            />
          </Grid>
        </Grid>
        <MonthlySummaryTable items={monthlySummaryItems} />
        <RecentReportList reports={recentReports} />
      </Box>
    );
  }

  // Member ロール（デフォルト）: MyReportCountCards + RecentReportList を表示する。
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <MyReportCountCards
        draftCount={dashboard?.my_draft_count ?? 0}
        submittedCount={dashboard?.my_submitted_count ?? 0}
        rejectedCount={dashboard?.my_rejected_count ?? 0}
      />
      <RecentReportList reports={recentReports} />
    </Box>
  );
}
