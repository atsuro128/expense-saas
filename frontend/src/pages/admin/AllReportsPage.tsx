// AllReportsPage: テナント全レポート一覧画面（SCR-ADM-001）
// Admin および Accounting ロールのみアクセス可能。他ロールはダッシュボード（/）にリダイレクトする。
// 403 エラー時もダッシュボードにリダイレクトする。
// 共通レイアウト（AppHeader + AppSidebar）は App.tsx の AppLayoutOutlet が適用するため、
// このページコンポーネントは AppLayout を自前でラップしない。

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllReports, type AllReportsParams } from '../../hooks/useAllReports';
import { useTenantMembers } from '../../hooks/useTenantMembers';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ApiClientError } from '../../api/client';
import type { AllReportRow } from '../../api/adminTypes';
import PageTitle from '../../components/ui/PageTitle';
import AppToast from '../../components/ui/AppToast';
import AppPagination from '../../components/ui/AppPagination';
import AllReportsFilterBar, { type AllReportsFilterValues } from './AllReportsFilterBar';
import AllReportsTable from './AllReportsTable';

export type { AllReportRow };

/**
 * AllReportsPage はテナント全レポート一覧画面のページコンポーネント。
 * Admin および Accounting ロールのみ利用可能。他ロールはダッシュボードにリダイレクトする。
 */
export default function AllReportsPage() {
  const navigate = useNavigate();
  const { data: userData } = useCurrentUser();
  const currentUser = userData?.data;

  // フィルタ状態。
  const [filters, setFilters] = useState<AllReportsFilterValues>({
    status: '',
    from: null,
    to: null,
    submitterId: '',
  });

  // ページ状態。
  const [page, setPage] = useState(1);

  // データフェッチ。
  const queryParams: AllReportsParams = {
    page,
    per_page: 20,
    status: filters.status || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    submitter_id: filters.submitterId || undefined,
  };
  const { data, isLoading, error } = useAllReports(queryParams);
  const { data: membersData, isLoading: membersLoading } = useTenantMembers();
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Admin / Accounting 以外のロールはダッシュボードにリダイレクトし、トーストで理由を通知する。
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'accounting') {
      navigate('/dashboard', {
        state: {
          toast: {
            severity: 'error',
            message: 'この画面にアクセスする権限がありません。',
          },
        },
        replace: true,
      });
    }
  }, [currentUser, navigate]);

  // 403 エラー時はダッシュボードにリダイレクトし、トーストで理由を通知する。
  useEffect(() => {
    if (error instanceof ApiClientError && error.status === 403) {
      navigate('/dashboard', {
        state: {
          toast: {
            severity: 'error',
            message: 'この画面にアクセスする権限がありません。',
          },
        },
        replace: true,
      });
    }
  }, [error, navigate]);

  // 500 系エラーはトーストで通知する。
  useEffect(() => {
    if (error instanceof ApiClientError && error.status >= 500) {
      setToastMessage('サーバーエラーが発生しました');
      setToastOpen(true);
    }
  }, [error]);

  // フィルタ変更時にページをリセットする。
  const handleFilterChange = (newFilters: AllReportsFilterValues) => {
    setFilters(newFilters);
    setPage(1);
  };

  // 行クリック時にレポート詳細画面に遷移する。
  const handleRowClick = (reportId: string) => {
    navigate(`/reports/${reportId}`);
  };

  const reports = data?.data ?? [];
  const members = membersData?.data ?? [];
  const totalPages = data?.pagination?.total_pages ?? 1;

  // アクティブなフィルタが存在するか判定する。
  const hasActiveFilters =
    !!filters.status || !!filters.from || !!filters.to || !!filters.submitterId;

  return (
    <>
      <PageTitle title="全レポート" />
      <AllReportsFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        members={members}
        membersLoading={membersLoading}
      />
      <AllReportsTable
        reports={reports}
        loading={isLoading}
        hasActiveFilters={hasActiveFilters}
        onRowClick={handleRowClick}
      />
      <AppPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(newPage) => setPage(newPage)}
      />
      <AppToast
        open={toastOpen}
        severity="error"
        message={toastMessage}
        onClose={() => setToastOpen(false)}
      />
    </>
  );
}
