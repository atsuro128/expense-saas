// AllReportsPage: テナント全レポート一覧画面（SCR-ADM-001）
// Admin および Accounting ロールのみアクセス可能。他ロールはダッシュボード（/）にリダイレクトする。
// 403 エラー時もダッシュボードにリダイレクトする。

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllReports, type AllReportsParams } from '../../hooks/useAllReports';
import { useTenantMembers } from '../../hooks/useTenantMembers';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useSnackbar } from '../../hooks/useSnackbar';
import { ApiClientError } from '../../api/client';
import type { AllReportRow } from '../../api/adminTypes';
import AllReportsFilterBar, { type AllReportsFilterValues } from './AllReportsFilterBar';
import AllReportsTable from './AllReportsTable';

export type { AllReportRow };

/**
 * AllReportsPage はテナント全レポート一覧画面のページコンポーネント。
 * Admin および Accounting ロールのみ利用可能。他ロールはダッシュボードにリダイレクトする。
 */
export default function AllReportsPage() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();

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
  const { showError } = useSnackbar();

  // Admin / Accounting 以外のロールはダッシュボードにリダイレクトする。
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'accounting') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // 403 エラー時はダッシュボードにリダイレクトする。
  useEffect(() => {
    if (error instanceof ApiClientError && error.status === 403) {
      navigate('/');
    }
  }, [error, navigate]);

  // 500 系エラーはトーストで通知する。
  useEffect(() => {
    if (error instanceof ApiClientError && error.status >= 500) {
      showError('サーバーエラーが発生しました');
    }
  }, [error, showError]);

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

  // アクティブなフィルタが存在するか判定する。
  const hasActiveFilters =
    !!filters.status || !!filters.from || !!filters.to || !!filters.submitterId;

  return (
    <div>
      <h1>全レポート一覧</h1>
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
    </div>
  );
}
