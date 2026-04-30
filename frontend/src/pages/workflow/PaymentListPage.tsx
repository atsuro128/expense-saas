// 支払待ちレポート一覧ページ（PaymentListPage）。
// SCR-WFL-002 に対応する。
// Accounting ロールのユーザーが支払待ちのレポートを一覧表示する。

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import TextField from '@mui/material/TextField';
import AppDataGrid from '../../components/ui/AppDataGrid';
import AppPaginationFooter from '../../components/ui/AppPaginationFooter';
import AppToast from '../../components/ui/AppToast';
import PageSkeleton from '../../components/ui/PageSkeleton';
import FilterResetButton from '../../components/ui/FilterResetButton';
import SelfLabel from '../../components/ui/SelfLabel';
import { usePayableReports } from '../../hooks/useReports';
import { useCurrentUser } from '../../hooks/useCurrentUser';

/** ページ root 要素の data-testid。テストから参照するためエクスポートする。 */
export const PAGE_TEST_ID = 'payable-reports-page';

/** テーブルのカラム定義。openapi.yaml の PayableReport フィールドに準拠する。 */
// 行末 ChevronRight アイコンは表示しない（issue #155 対応）。
// 行クリック + cursor:pointer のみで操作可能性を表現する。
// flex を使用せず width（絶対値）で列幅を固定する（issue #160 対応・候補 A 採用）。
// flex を使うと MUI X DataGrid がコンテナ幅に合わせて列幅を縮小するため minWidth が効かなくなる問題を解消する。
// width 固定により列幅合計（540px）がスマホ幅（375px）を超えるため、
// ルート Box の overflowX: 'auto' による横スクロールが正常に発火する。
const COLUMNS: GridColDef[] = [
  {
    field: 'submitter_name',
    headerName: '申請者名',
    width: 120,
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
    width: 200,
  },
  {
    field: 'total_amount',
    headerName: '合計金額',
    width: 110,
    // 金額を ¥ プレフィックス付きで表示する。
    valueFormatter: (value: number) => `¥${value.toLocaleString()}`,
  },
  {
    field: 'approved_at',
    headerName: '承認日',
    width: 110,
    valueFormatter: (value: string | null) =>
      value ? new Date(value).toLocaleDateString('ja-JP') : '-',
  },
];

/**
 * PaymentListPage は支払待ちレポートの一覧を表示する画面。
 * Accounting ロール以外は即時リダイレクトする（同期ロールチェック）。
 * 403 エラー時はダッシュボードにリダイレクトする（フェイルセーフ）。
 * 500 エラー時は AppToast でエラーを表示する。
 */
export default function PaymentListPage() {
  const navigate = useNavigate();
  const { data: userData } = useCurrentUser();
  const currentUser = userData?.data;
  const [searchParams, setSearchParams] = useSearchParams();

  // URL クエリパラメータからフィルタ初期値を取得する。
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const applicantNameParam = searchParams.get('applicant_name') ?? '';

  // per_page: NaN/負数の場合は 20 にフォールバックする（issue #147 Q4）。
  // 範囲内不正値（0, 101 等）はそのまま BE に送り 422 エラーに委ねる。
  const perPageParam = searchParams.get('per_page');
  const perPageParsed = perPageParam !== null ? parseInt(perPageParam, 10) : NaN;
  const per_page = Number.isFinite(perPageParsed) && perPageParsed >= 0 ? perPageParsed : 20;

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

  // per_page 変更時は page=1 にリセットし、setSearchParams を 1 コールに集約する（issue #147 重要リスク 5）。
  const handlePerPageChange = (size: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('per_page', String(size));
    next.set('page', '1');
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

  // 同期ロールチェック: Accounting 以外はダッシュボードに即リダイレクトする。
  // API 403 レスポンスを待たず、ヘッダーのフラッシュ表示を防ぐ（issue-106 対応）。
  // authz.md L376-379 / screens/workflow-payable.md L23 に基づき Accounting のみ許可する。
  useEffect(() => {
    if (currentUser && currentUser.role !== 'accounting') {
      void navigate('/dashboard', {
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

  // 支払待ちレポート一覧データを取得する。per_page を URL から転送する。
  const { data, isLoading, isError, error } = usePayableReports({
    page,
    per_page,
    applicant_name: applicantNameParam || undefined,
  });

  // 403 エラー時はダッシュボードにリダイレクトし、トーストで理由を通知する。
  useEffect(() => {
    if (isError && error && (error as { status?: number }).status === 403) {
      void navigate('/dashboard', {
        state: {
          toast: {
            severity: 'error',
            message: 'この画面にアクセスする権限がありません。',
          },
        },
        replace: true,
      });
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

  // currentUser が未取得、またはロール不一致の場合は何もレンダリングしない。
  // ロール不一致時は上記 useEffect がリダイレクトを実行する。
  if (!currentUser || currentUser.role !== 'accounting') {
    return null;
  }

  return (
    <div data-testid="payable-reports-page">
      {/* ページタイトル（ローディング中も常時表示） */}
      <div>
        <h1>支払待ち一覧</h1>
      </div>

      {/* フィルタ（ローディング中も常時表示。初期値は URL クエリから取得済み） */}
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

      {/* テーブル領域: ローディング中はスケルトン表示、完了後はグリッドを表示（issue 116 対応） */}
      {isLoading ? (
        <PageSkeleton variant="table" />
      ) : (
        <>
          {/* 件数表示（データがある場合のみ） */}
          {reports.length > 0 && (
            <p>{totalCount} 件の支払待ちレポート</p>
          )}

          {/* データグリッド（emptyMessage で空状態も表示） */}
          {/* slots.footer 経由で AppPaginationFooter を DataGrid フッターコンテナに統合する（issue #147 再オープン D-1 直接利用パターン） */}
          <AppDataGrid
            columns={COLUMNS}
            rows={rows}
            loading={false}
            hideFooterPagination
            emptyMessage={emptyMessage}
            onRowClick={(params: GridRowParams) => void navigate(`/reports/${(params.row as { id: string }).id}`)}
            sx={{ cursor: 'pointer' }}
            slots={{
              footer: () => (
                <AppPaginationFooter
                  currentPage={pagination?.current_page ?? page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  perPage={pagination?.per_page ?? per_page}
                  onPerPageChange={handlePerPageChange}
                  disabled={isLoading}
                  totalCount={pagination?.total_count}
                />
              ),
            }}
          />
        </>
      )}

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
