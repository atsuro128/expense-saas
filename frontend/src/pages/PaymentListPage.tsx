// 支払待ちレポート一覧ページ（PaymentListPage）。
// SCR-WFL-002 に対応する。
// Accounting ロールのユーザーが支払待ちのレポートを一覧表示する。

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import TextField from '@mui/material/TextField';
import AppDataGrid from '../components/ui/AppDataGrid';
import AppPagination from '../components/ui/AppPagination';
import AppToast from '../components/ui/AppToast';
import PageSkeleton from '../components/ui/PageSkeleton';
import FilterResetButton from '../components/ui/FilterResetButton';
import SelfLabel from '../components/ui/SelfLabel';
import { usePayableReports } from '../hooks/useReports';

/** テーブルのカラム定義。openapi.yaml の PayableReport フィールドに準拠する。 */
const COLUMNS: GridColDef[] = [
  {
    field: 'submitter_name',
    headerName: '申請者名',
    flex: 1,
    // 申請者名と「自分」ラベルを並べて表示する。
    renderCell: (params) => (
      <>
        {params.row.submitter_name as string}
        <SelfLabel isOwnReport={params.row.is_own_report as boolean} />
      </>
    ),
  },
  {
    field: 'title',
    headerName: 'タイトル',
    flex: 2,
  },
  {
    field: 'total_amount',
    headerName: '合計金額',
    flex: 1,
    // 金額を ¥ プレフィックス付きで表示する。
    valueFormatter: (value: number) => `¥${value.toLocaleString()}`,
  },
  {
    field: 'approved_at',
    headerName: '承認日',
    flex: 1,
    valueFormatter: (value: string | null) =>
      value ? new Date(value).toLocaleDateString('ja-JP') : '-',
  },
];

/**
 * PaymentListPage は支払待ちレポートの一覧を表示する画面。
 * 403 エラー時はダッシュボードにリダイレクトする。
 * 500 エラー時は AppToast でエラーを表示する。
 */
export default function PaymentListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL クエリパラメータからフィルタ初期値を取得する。
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const applicantNameParam = searchParams.get('applicant_name') ?? '';

  // 申請者名フィルタの入力値（デバウンス前）。
  const [applicantNameInput, setApplicantNameInput] = useState(applicantNameParam);

  // デバウンスされたフィルタ値（300ms 後に URL に反映）。
  const [debouncedApplicantName, setDebouncedApplicantName] = useState(applicantNameParam);

  // トーストの表示状態。
  const [toastOpen, setToastOpen] = useState(false);

  // 入力値のデバウンス処理（300ms 遅延）。
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedApplicantName(applicantNameInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [applicantNameInput]);

  // デバウンス後の値が変わったら URL パラメータを更新する。
  const handleApplicantNameChange = useCallback((value: string) => {
    setApplicantNameInput(value);
  }, []);

  // URL への反映はデバウンス後の値が変わったタイミングで行う。
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', '1');
    if (debouncedApplicantName) {
      next.set('applicant_name', debouncedApplicantName);
    } else {
      next.delete('applicant_name');
    }
    setSearchParams(next, { replace: true });
    // searchParams を依存に含めると無限ループするため意図的に除外する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedApplicantName]);

  // ページ変更ハンドラ。
  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(newPage));
    setSearchParams(next);
  };

  // フィルタリセットハンドラ。
  const handleFilterReset = () => {
    setApplicantNameInput('');
    setDebouncedApplicantName('');
    const next = new URLSearchParams();
    setSearchParams(next);
  };

  // フィルタが適用されているかどうか。
  const isFiltered = !!applicantNameParam;

  // 支払待ちレポート一覧データを取得する。
  const { data, isLoading, isError, error } = usePayableReports({
    page,
    applicant_name: applicantNameParam || undefined,
  });

  // 403 エラー時はダッシュボードにリダイレクトする。
  useEffect(() => {
    if (isError && error && (error as { status?: number }).status === 403) {
      void navigate('/dashboard');
    }
  }, [isError, error, navigate]);

  // 500 エラー（非 403）時はトーストを表示する。
  useEffect(() => {
    if (isError && error && (error as { status?: number }).status !== 403) {
      setToastOpen(true);
    }
  }, [isError, error]);

  const reports = data?.data ?? [];
  const pagination = data?.pagination;
  const totalCount = pagination?.total_count ?? 0;
  const totalPages = pagination?.total_pages ?? 1;

  // AppDataGrid の rows に変換する。submitter_name をフラット化する。
  const rows = reports.map((report) => ({
    ...report,
    submitter_name: report.submitter?.name ?? '',
  })) as readonly Record<string, unknown>[];

  // 空状態メッセージをフィルタ有無で切り替える。
  const emptyMessage = isFiltered
    ? '条件に一致するレポートはありません。'
    : '支払待ちのレポートはありません。';

  // ローディング中はスケルトンを表示する。
  if (isLoading) {
    return (
      <div data-testid="payable-reports-page">
        <PageSkeleton variant="table" />
      </div>
    );
  }

  return (
    <div data-testid="payable-reports-page">
      {/* ページタイトル */}
      <div>
        <h1>支払待ち一覧</h1>
      </div>

      {/* フィルタ */}
      <div>
        <TextField
          type="text"
          size="small"
          value={applicantNameInput}
          onChange={(e) => handleApplicantNameChange(e.target.value)}
          placeholder="申請者名で絞り込み"
          label="申請者名"
          inputProps={{ 'data-testid': 'payable-filter-applicant-name', 'aria-label': '申請者名フィルタ' }}
        />
        <FilterResetButton onReset={handleFilterReset} isFiltered={isFiltered} />
      </div>

      {/* 件数表示（データがある場合のみ） */}
      {reports.length > 0 && (
        <p>{totalCount} 件の支払待ちレポート</p>
      )}

      {/* データグリッド（emptyMessage で空状態も表示） */}
      <AppDataGrid
        columns={COLUMNS}
        rows={rows}
        loading={false}
        hideFooterPagination
        emptyMessage={emptyMessage}
        onRowClick={(params: GridRowParams) => void navigate(`/reports/${(params.row as { id: string }).id}`)}
        sx={{ cursor: 'pointer' }}
      />

      {/* ページネーション */}
      <AppPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* エラートースト */}
      <AppToast
        open={toastOpen}
        severity="error"
        message="サーバーエラーが発生しました"
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
}
