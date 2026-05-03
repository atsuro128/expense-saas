// 処理済みレポート一覧ページ（ProcessedReportsPage）。
// SCR-WFL-003 に対応する。
// Approver ロールのユーザーが自分が処理（承認/却下）したレポートを一覧表示する。
// workflow-processed.md 仕様準拠。

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import Chip from '@mui/material/Chip';
import AppDataGrid from '../../components/ui/AppDataGrid';
import AppPaginationFooter from '../../components/ui/AppPaginationFooter';
import AppToast from '../../components/ui/AppToast';
import PageSkeleton from '../../components/ui/PageSkeleton';
import StatusChip from '../../components/ui/StatusChip';
import { useProcessedReports } from '../../hooks/useReports';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import type { ReportStatus } from '../../components/ui/StatusChip';

/** ページ root 要素の data-testid。テストから参照するためエクスポートする。 */
export const PAGE_TEST_ID = 'processed-reports-page';

/**
 * 処理結果バッジを描画するヘルパー。
 * decision=approved → 緑バッジ「承認」、decision=rejected → 赤バッジ「却下」。
 * screens.md §4.8 ステータスバッジ準拠（approved=success=緑、rejected=error=赤）。
 */
function DecisionBadge({ decision }: { decision: 'approved' | 'rejected' }) {
  return (
    <Chip
      label={decision === 'approved' ? '承認' : '却下'}
      color={decision === 'approved' ? 'success' : 'error'}
      size="small"
      data-testid={`decision-badge-${decision}`}
    />
  );
}

/** テーブルのカラム定義。openapi.yaml の ProcessedReport フィールドおよび workflow-processed.md §5 に準拠する。 */
// 行末 ChevronRight アイコンは表示しない（issue #155 対応）。
// 行クリック + cursor:pointer のみで操作可能性を表現する。
// minWidth はスマホ幅で列内容が読めるよう設定する（issue #160 対応）。
const COLUMNS: GridColDef[] = [
  {
    field: 'submitter_name',
    headerName: '申請者名',
    flex: 1,
    minWidth: 120,
  },
  {
    field: 'title',
    headerName: 'タイトル',
    flex: 2,
    minWidth: 200,
  },
  {
    field: 'total_amount',
    headerName: '合計金額',
    flex: 1,
    minWidth: 130,
    // 金額を ¥ プレフィックス付きで表示する。
    valueFormatter: (value: number) => `¥${value.toLocaleString()}`,
  },
  {
    field: 'decision',
    headerName: '処理結果',
    flex: 1,
    minWidth: 120,
    // 処理結果バッジ（承認=緑、却下=赤）を表示する。
    renderCell: (params) => (
      <DecisionBadge decision={params.row.decision as 'approved' | 'rejected'} />
    ),
  },
  {
    field: 'decided_at',
    headerName: '処理日',
    flex: 1,
    minWidth: 110,
    // YYYY/MM/DD 形式で表示する（デフォルト降順は BE 側で保証）。
    valueFormatter: (value: string | null) =>
      value ? new Date(value).toLocaleDateString('ja-JP') : '-',
  },
  {
    field: 'current_status',
    headerName: '現在ステータス',
    flex: 1,
    minWidth: 170,
    // StatusChip でバッジ表示する（approved=緑「承認済み」/ rejected=赤「却下」/ paid=紫「支払済み」）。
    renderCell: (params) => (
      <StatusChip status={params.row.current_status as ReportStatus} />
    ),
  },
];

/**
 * ProcessedReportsPage は処理済みレポートの一覧を表示する画面。
 * Approver ロール以外は即時リダイレクトする（同期ロールチェック）。
 * 403 エラー時はダッシュボードにリダイレクトする（フェイルセーフ）。
 * 500 エラー時は AppToast でエラーを表示する。
 * SCR-WFL-003 / workflow-processed.md 仕様準拠。
 */
export default function ProcessedReportsPage() {
  const navigate = useNavigate();
  const { data: userData } = useCurrentUser();
  const currentUser = userData?.data;
  const [searchParams, setSearchParams] = useSearchParams();

  // URL クエリパラメータからページネーション初期値を取得する。
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  // per_page: NaN/負数の場合は 20 にフォールバックする（issue #147 Q4）。
  // 範囲内不正値（0, 101 等）はそのまま BE に送り 422 エラーに委ねる。
  const perPageParam = searchParams.get('per_page');
  const perPageParsed = perPageParam !== null ? parseInt(perPageParam, 10) : NaN;
  const per_page = Number.isFinite(perPageParsed) && perPageParsed >= 0 ? perPageParsed : 20;

  // トーストの表示状態。
  const [toastOpen, setToastOpen] = useState(false);

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

  // 同期ロールチェック: Approver 以外はダッシュボードに即リダイレクトする。
  // API 403 レスポンスを待たず、ヘッダーのフラッシュ表示を防ぐ（issue-106 対応）。
  // authz.md / workflow-processed.md §1 に基づき Approver のみ許可する。
  useEffect(() => {
    if (currentUser && currentUser.role !== 'approver') {
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

  // 処理済みレポート一覧データを取得する。per_page を URL から転送する。
  const { data, isLoading, isError, error } = useProcessedReports({
    page,
    per_page,
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
  const totalPages = pagination?.total_pages ?? 1;

  // AppDataGrid の rows に変換する。submitter_name をフラット化する。
  const rows = reports.map((report) => ({
    ...report,
    submitter_name: report.submitter?.name ?? '',
  })) as readonly Record<string, unknown>[];

  // currentUser が未取得、またはロール不一致の場合は何もレンダリングしない。
  // ロール不一致時は上記 useEffect がリダイレクトを実行する。
  if (!currentUser || currentUser.role !== 'approver') {
    return null;
  }

  return (
    <div data-testid="processed-reports-page">
      {/* ページタイトル（ローディング中も常時表示） */}
      <div>
        <h1>処理済みレポート一覧</h1>
      </div>

      {/* テーブル領域: ローディング中はスケルトン表示、完了後はグリッドを表示（issue 116 対応） */}
      {isLoading ? (
        <PageSkeleton variant="table" />
      ) : (
        <>
          {/* データグリッド（emptyMessage で空状態も表示） */}
          {/* slots.footer 経由で AppPaginationFooter を DataGrid フッターコンテナに統合する（issue #147 再オープン D-1 直接利用パターン） */}
          <AppDataGrid
            columns={COLUMNS}
            rows={rows}
            loading={false}
            hideFooterPagination
            emptyMessage="処理済みのレポートはありません。"
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
