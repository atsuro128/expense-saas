// AllReportsPage: テナント全レポート一覧画面（SCR-ADM-001）
// Admin および Accounting ロールのみアクセス可能。他ロールはダッシュボード（/）にリダイレクトする。
// 403 エラー時もダッシュボードにリダイレクトする。
// 共通レイアウト（AppHeader + AppSidebar）は App.tsx の AppLayoutOutlet が適用するため、
// このページコンポーネントは AppLayout を自前でラップしない。
// issue #147 Q2: page / filters / per_page を全て URL 駆動に移行済み。

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAllReports, type AllReportsParams } from '../../hooks/useAllReports';
import { useTenantMembers } from '../../hooks/useTenantMembers';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ApiClientError } from '../../api/client';
import type { AllReportRow } from '../../api/adminTypes';
import PageTitle from '../../components/ui/PageTitle';
import AppToast from '../../components/ui/AppToast';
import AppPaginationFooter from '../../components/ui/AppPaginationFooter';
import AllReportsFilterBar, { type AllReportsFilterValues } from './AllReportsFilterBar';
import AllReportsTable from './AllReportsTable';
import { useState } from 'react';

export type { AllReportRow };

/**
 * AllReportsPage はテナント全レポート一覧画面のページコンポーネント。
 * Admin および Accounting ロールのみ利用可能。他ロールはダッシュボードにリダイレクトする。
 * page / filters / per_page はすべて URL クエリパラメータで管理する（issue #147 Q2）。
 */
export default function AllReportsPage() {
  const navigate = useNavigate();
  const { data: userData } = useCurrentUser();
  const currentUser = userData?.data;
  const [searchParams, setSearchParams] = useSearchParams();

  // URL クエリパラメータから page を読み取る。
  const pageParam = searchParams.get('page');
  const page = pageParam !== null ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

  // per_page: NaN/負数の場合は 20 にフォールバックする（issue #147 Q4）。
  // 範囲内不正値（0, 101 等）はそのまま BE に送り 422 エラーに委ねる。
  const perPageParam = searchParams.get('per_page');
  const perPageParsed = perPageParam !== null ? parseInt(perPageParam, 10) : NaN;
  const per_page = Number.isFinite(perPageParsed) && perPageParsed >= 0 ? perPageParsed : 20;

  // URL クエリパラメータからフィルタ値を読み取る。
  const filters: AllReportsFilterValues = {
    status: searchParams.get('status') ?? '',
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    submitterId: searchParams.get('submitter_id') ?? '',
  };

  // トースト状態（エラー表示用）。
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // データフェッチ。
  const queryParams: AllReportsParams = {
    page,
    per_page,
    status: filters.status || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    submitter_id: filters.submitterId || undefined,
  };
  const { data, isLoading, error } = useAllReports(queryParams);
  const { data: membersData, isLoading: membersLoading } = useTenantMembers();

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
      setToastMessage(error.message);
      setToastOpen(true);
    }
  }, [error]);

  // フィルタ変更時: URL クエリパラメータを更新し page=1 にリセットする。
  const handleFilterChange = (newFilters: AllReportsFilterValues) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', '1');
    if (newFilters.status) {
      next.set('status', newFilters.status);
    } else {
      next.delete('status');
    }
    if (newFilters.from) {
      next.set('from', newFilters.from);
    } else {
      next.delete('from');
    }
    if (newFilters.to) {
      next.set('to', newFilters.to);
    } else {
      next.delete('to');
    }
    if (newFilters.submitterId) {
      next.set('submitter_id', newFilters.submitterId);
    } else {
      next.delete('submitter_id');
    }
    setSearchParams(next);
  };

  // ページ変更ハンドラ。
  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(newPage));
    setSearchParams(next);
  };

  // per_page 変更時は page=1 にリセットし、setSearchParams を 1 コールに集約する（issue #147 重要リスク 5）。
  const handlePerPageChange = (size: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('per_page', String(size));
    next.set('page', '1');
    setSearchParams(next);
  };

  // 行クリック時にレポート詳細画面に遷移する。
  const handleRowClick = (reportId: string) => {
    navigate(`/reports/${reportId}`);
  };

  const reports = data?.data ?? [];
  const members = membersData?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.total_pages ?? 1;

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
      {/* ページネーションフッター: 常時表示（issue #147 Q3）。ローディング中は disabled */}
      <AppPaginationFooter
        currentPage={pagination?.current_page ?? page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        perPage={pagination?.per_page ?? per_page}
        onPerPageChange={handlePerPageChange}
        disabled={isLoading}
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
