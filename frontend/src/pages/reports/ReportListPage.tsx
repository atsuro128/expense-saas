// レポート一覧ページ。
// RPT-FE-001〜007 の仕様に対応する。
// URL クエリパラメータでフィルタ条件・ページ番号を管理する。

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AppToast from '../../components/ui/AppToast';
import AppPaginationFooter from '../../components/ui/AppPaginationFooter';
import AppSelect from '../../components/ui/AppSelect';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { useMyReports } from '../../hooks/useReports';
import ReportListTable from './ReportListTable';

/** ステータスフィルタの選択肢 */
const STATUS_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'draft', label: '下書き' },
  { value: 'submitted', label: '提出済み' },
  { value: 'approved', label: '承認済み' },
  { value: 'rejected', label: '却下' },
  { value: 'paid', label: '支払済み' },
];

/**
 * ReportListPage は自分のレポート一覧を表示する画面。
 * URL クエリパラメータからフィルタ条件を復元し useMyReports でデータ取得する。
 */
export default function ReportListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // URL クエリパラメータからフィルタ初期値を取得する。
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const status = searchParams.get('status') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  // per_page: NaN/負数の場合は 20 にフォールバックする（issue #147 Q4）。
  // 範囲内不正値（0, 101 等）はそのまま BE に送り 422 エラーに委ねる。
  const perPageParam = searchParams.get('per_page');
  const perPageParsed = perPageParam !== null ? parseInt(perPageParam, 10) : NaN;
  const per_page = Number.isFinite(perPageParsed) && perPageParsed >= 0 ? perPageParsed : 20;

  // トースト表示状態（エラー用）。
  const [toastOpen, setToastOpen] = useState(false);

  // ナビゲーション経由のトースト状態（削除成功等）。
  const [navToast, setNavToast] = useState<{ open: boolean; severity: 'success' | 'error'; message: string }>({
    open: false,
    severity: 'success',
    message: '',
  });

  // レポート一覧データを取得する。per_page を URL から転送する。
  const { data, isLoading, isError, error } = useMyReports({
    page,
    per_page,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  // エラー時はトーストを表示する。
  const shouldShowError = isError && error !== null;

  // ナビゲーション state にトーストが含まれる場合は表示し、state をクリアして二重表示を防ぐ。
  useEffect(() => {
    const stateToast = (location.state as { toast?: { severity: 'success' | 'error'; message: string } } | null)?.toast;
    if (stateToast) {
      setNavToast({ open: true, ...stateToast });
      // history state をクリアして再レンダリング時に再表示しない。
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  /**
   * MUI Select の display div に value プロパティを設定する。
   * testing-library の toHaveValue() がこのプロパティを参照して値を検証できるようにする。
   */
  useEffect(() => {
    const el = document.querySelector('[data-testid="report-list-filter-status"]') as HTMLElement & { value?: string };
    if (el) {
      el.value = status;
    }
  });

  /**
   * フィルタ変更時に URL クエリパラメータを更新し page を 1 にリセットする。
   */
  const handleStatusChange = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', '1');
    if (value) {
      next.set('status', value);
    } else {
      next.delete('status');
    }
    setSearchParams(next);
  };

  const handleFromChange = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', '1');
    if (value) {
      next.set('from', value);
    } else {
      next.delete('from');
    }
    setSearchParams(next);
  };

  const handleToChange = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', '1');
    if (value) {
      next.set('to', value);
    } else {
      next.delete('to');
    }
    setSearchParams(next);
  };

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

  const reports = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <Box>
      {/* エラートースト */}
      {shouldShowError && (
        <AppToast
          open={!toastOpen}
          severity="error"
          message={error instanceof Error ? error.message : 'データの取得に失敗しました'}
          onClose={() => setToastOpen(true)}
        />
      )}

      {/* ナビゲーション経由のトースト（削除成功等） */}
      <AppToast
        open={navToast.open}
        severity={navToast.severity}
        message={navToast.message}
        onClose={() => setNavToast((prev) => ({ ...prev, open: false }))}
      />

      {/* レポート一覧ヘッダー（ローディング中も常時表示） */}
      <Box
        data-testid="report-list-header"
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Typography variant="h5">マイレポート</Typography>
        <Button
          data-testid="create-report-button"
          variant="contained"
          onClick={() => navigate('/reports/new')}
        >
          + レポート作成
        </Button>
      </Box>

      {/* フィルター（ローディング中も常時表示。初期値は URL クエリから取得済み）
       * flex-wrap で mobile では自動折り返し（issue #165 対応）。
       * 各要素に固定幅を指定して PC では横並び、375px では 2 列以上に折り返す。
       */}
      <Box
        data-testid="report-list-filter"
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}
      >
        {/*
         * ステータスフィルタ。
         * AppSelect の selectDisplayProps に data-testid を設定して display div をテストで取得可能にする。
         * useEffect で display div の value プロパティを設定し toHaveValue() を機能させる。
         */}
        <AppSelect
          name="status"
          label="ステータス"
          options={STATUS_OPTIONS}
          value={status}
          onChange={handleStatusChange}
          fullWidth={false}
          sx={{ width: 140 }}
          selectDisplayProps={{ 'data-testid': 'report-list-filter-status' }}
        />

        {/* 開始日フィルタ */}
        <TextField
          type="date"
          size="small"
          label="開始日"
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'data-testid': 'report-list-filter-from', 'aria-label': '開始日' }}
          value={from}
          onChange={(e) => handleFromChange(e.target.value)}
          sx={{ width: 170 }}
        />

        {/* 終了日フィルタ */}
        <TextField
          type="date"
          size="small"
          label="終了日"
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'data-testid': 'report-list-filter-to', 'aria-label': '終了日' }}
          value={to}
          onChange={(e) => handleToChange(e.target.value)}
          sx={{ width: 170 }}
        />
      </Box>

      {/* テーブル領域: ローディング中はスケルトン表示、完了後は ReportListTable を表示（issue 116 対応） */}
      {isLoading ? (
        <PageSkeleton variant="table" />
      ) : (
        <Box data-testid="report-list-table">
          {/* ReportListTable（DataGrid + StatusChip）でステータスを日本語 Chip 表示する（issue #139 対応） */}
          {/* paginationFooter: AppPaginationFooter を slots.footer 経由で DataGrid フッターコンテナに統合する（issue #147 再オープン D-1 ②a） */}
          <ReportListTable
            reports={reports.map((r) => ({
              id: r.id,
              title: r.title,
              periodStart: r.period_start,
              periodEnd: r.period_end,
              totalAmount: r.total_amount,
              status: r.status,
              createdAt: r.created_at,
            }))}
            onRowClick={(id) => navigate(`/reports/${id}`)}
            onCreateReport={() => navigate('/reports/new')}
            paginationFooter={
              <AppPaginationFooter
                currentPage={pagination?.current_page ?? page}
                totalPages={pagination?.total_pages ?? 1}
                onPageChange={handlePageChange}
                perPage={pagination?.per_page ?? per_page}
                onPerPageChange={handlePerPageChange}
                disabled={isLoading}
                totalCount={pagination?.total_count}
              />
            }
          />
        </Box>
      )}
    </Box>
  );
}
