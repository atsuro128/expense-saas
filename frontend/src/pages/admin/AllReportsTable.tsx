// AllReportsTable: テナント全レポートのテーブル表示を管理するコンポーネント。
// データが存在する場合は AppDataGrid で一覧を描画し、0件の場合は EmptyState を表示する。
// ローディング中は PageSkeleton を表示する。行クリックでレポート詳細画面に遷移する。
// 共通コンポーネント AppDataGrid / StatusChip / EmptyState / PageSkeleton を使用する。
// 55_ui_component/screens/admin-all-reports.md §AllReportsTable 参照。
// paginationFooter?: ReactNode を受け取り、AppDataGrid の slots.footer 経由で DataGrid フッターコンテナに統合する（issue #147 再オープン D-1 ②a 中間ラッパー経由パターン）。

import type { ReactNode } from 'react';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import AppDataGrid from '../../components/ui/AppDataGrid';
import StatusChip from '../../components/ui/StatusChip';
import EmptyState from '../../components/ui/EmptyState';
import PageSkeleton from '../../components/ui/PageSkeleton';
import type { AllReportRow } from '../../api/adminTypes';
import type { ReportStatus } from '../../components/ui/StatusChip';

/** AllReportsTable コンポーネントの Props。 */
interface AllReportsTableProps {
  /** テーブルに表示するレポート行データ */
  reports: AllReportRow[];
  /** ローディング状態 */
  loading: boolean;
  /** フィルタが適用されているか（空状態メッセージの切り替えに使用） */
  hasActiveFilters: boolean;
  /** 行クリック時のコールバック（レポート詳細画面への遷移） */
  onRowClick: (reportId: string) => void;
  /**
   * DataGrid フッターコンテナ（MuiDataGrid-footerContainer）に統合するページネーションフッター。
   * 渡された ReactNode は AppDataGrid の slots.footer 経由で DataGrid 内部に描画される（issue #147 再オープン D-1 ②a）。
   */
  paginationFooter?: ReactNode;
}

/** テーブルのカラム定義。openapi.yaml の ExpenseReportSummary に準拠した snake_case プロパティを参照する。 */
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
    minWidth: 100,
    // 金額を ¥ プレフィックス付きで表示する。
    valueFormatter: (value: number) => `¥${value.toLocaleString()}`,
  },
  {
    field: 'status',
    headerName: 'ステータス',
    flex: 1,
    minWidth: 100,
    // StatusChip コンポーネントで色分け表示する。
    renderCell: (params) => <StatusChip status={params.value as ReportStatus} />,
  },
  {
    field: 'submitted_at',
    headerName: '提出日',
    flex: 1,
    minWidth: 110,
    valueFormatter: (value: string | null) =>
      value ? new Date(value).toLocaleDateString('ja-JP') : '-',
  },
];

/**
 * AllReportsTable はテナント全レポートのテーブル表示を担うコンポーネント。
 * AppDataGrid / StatusChip / EmptyState / PageSkeleton 共通コンポーネントを使用する。
 * 0 件のときは AppDataGrid の noRowsOverlay に EmptyState を渡して表示する（issue #147 Q3 対応）。
 * 空状態でも AppDataGrid は常に描画され、slots.footer（paginationFooter）が常時表示される。
 * paginationFooter を渡すと DataGrid フッターコンテナ内に AppPaginationFooter 等を統合できる（issue #147 再オープン D-1）。
 */
export default function AllReportsTable({
  reports,
  loading,
  hasActiveFilters,
  onRowClick,
  paginationFooter,
}: AllReportsTableProps) {
  // ローディング中は PageSkeleton（variant="table"）を表示する。
  if (loading) {
    return <PageSkeleton variant="table" />;
  }

  // AppDataGrid の rows に変換する。申請者名は submitter.name をフラットにする。
  const rows = reports.map((report) => ({
    ...report,
    submitter_name: report.submitter.name,
  })) as readonly Record<string, unknown>[];

  // 空状態時は noRowsOverlay で EmptyState を描画する（issue #147 Q3: フッター非表示仕様の撤廃）。
  // フィルタ有無でメッセージを切り替える。
  const emptyMessage = hasActiveFilters
    ? '条件に一致するレポートはありません。フィルタを変更してお試しください。'
    : 'レポートはまだ作成されていません。';

  // paginationFooter が渡された場合は slots.footer 経由で DataGrid フッターコンテナに統合する（issue #147 再オープン D-1 ②a）。
  // slots.footer を上書きすると DataGrid 標準ページネーション UI が完全に置換されるため hideFooterPagination は不要になるが、
  // 二重表示防止の安全策として維持する。
  const slots = {
    noRowsOverlay: () => <EmptyState message={emptyMessage} />,
    ...(paginationFooter ? { footer: () => paginationFooter } : {}),
  };

  return (
    <AppDataGrid
      columns={COLUMNS}
      rows={rows}
      hideFooterPagination
      slots={slots}
      onRowClick={(params: GridRowParams) => onRowClick(params.row.id as string)}
      sx={{ cursor: 'pointer' }}
    />
  );
}
