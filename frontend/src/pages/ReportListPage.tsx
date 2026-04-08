// レポート一覧ページ。
// RPT-FE-001〜007 の仕様に対応する。
// URL クエリパラメータでフィルタ条件・ページ番号を管理する。

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import AppToast from '../components/ui/AppToast';
import AppPagination from '../components/ui/AppPagination';
import PageSkeleton from '../components/ui/PageSkeleton';
import { useMyReports } from '../hooks/useReports';

/** ステータスフィルタの選択肢 */
const STATUS_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'draft', label: '下書き' },
  { value: 'submitted', label: '提出済み' },
  { value: 'approved', label: '承認済み' },
  { value: 'rejected', label: '却下済み' },
  { value: 'paid', label: '支払完了' },
];

/**
 * ReportListPage は自分のレポート一覧を表示する画面。
 * URL クエリパラメータからフィルタ条件を復元し useMyReports でデータ取得する。
 */
export default function ReportListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL クエリパラメータからフィルタ初期値を取得する。
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const status = searchParams.get('status') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  // トースト表示状態。
  const [toastOpen, setToastOpen] = useState(false);

  // レポート一覧データを取得する。
  const { data, isLoading, isError, error } = useMyReports({
    page,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  // エラー時はトーストを表示する。
  const shouldShowError = isError && error !== null;

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

  // ローディング中はスケルトン表示。
  if (isLoading) {
    return <PageSkeleton variant="table" />;
  }

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

      {/* レポート一覧ヘッダー */}
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

      {/* フィルター */}
      <Box
        data-testid="report-list-filter"
        sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}
      >
        {/*
         * ステータスフィルタ。
         * SelectDisplayProps に data-testid を設定して display div をテストで取得可能にする。
         * useEffect で display div の value プロパティを設定し toHaveValue() を機能させる。
         */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as string)}
            displayEmpty
            SelectDisplayProps={{ 'data-testid': 'report-list-filter-status' } as React.HTMLAttributes<HTMLDivElement>}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 開始日フィルタ */}
        <input
          data-testid="report-list-filter-from"
          type="date"
          value={from}
          onChange={(e) => handleFromChange(e.target.value)}
          aria-label="開始日"
        />

        {/* 終了日フィルタ */}
        <input
          data-testid="report-list-filter-to"
          type="date"
          value={to}
          onChange={(e) => handleToChange(e.target.value)}
          aria-label="終了日"
        />
      </Box>

      {/* レポート一覧テーブル */}
      <Box data-testid="report-list-table">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>タイトル</TableCell>
              <TableCell>期間</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>合計金額</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              <TableRow
                key={report.id}
                data-testid={`report-row-${report.id}`}
                onClick={() => navigate(`/reports/${report.id}`)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>{report.title}</TableCell>
                <TableCell>
                  {report.period_start} 〜 {report.period_end}
                </TableCell>
                <TableCell>{report.status}</TableCell>
                <TableCell>{report.total_amount.toLocaleString()} 円</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* ページネーション */}
      {pagination && (
        <AppPagination
          currentPage={pagination.current_page}
          totalPages={pagination.total_pages}
          onPageChange={handlePageChange}
        />
      )}
    </Box>
  );
}
