// AllReportsTable: テナント全レポートのテーブル表示を管理するコンポーネント。
// データが存在する場合は AppDataGrid で一覧を描画し、0件の場合は EmptyState を表示する。
// ローディング中は PageSkeleton を表示する。行クリックでレポート詳細画面に遷移する。
// 共通コンポーネント AppDataGrid / StatusChip / EmptyState / PageSkeleton を使用する。
// 55_ui_component/screens/admin-all-reports.md §AllReportsTable 参照。

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
}

/** テーブルのカラム定義。openapi.yaml の ExpenseReportSummary に準拠した snake_case プロパティを参照する。 */
const COLUMNS: GridColDef[] = [
  {
    field: 'submitter_name',
    headerName: '申請者名',
    flex: 1,
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
    field: 'status',
    headerName: 'ステータス',
    flex: 1,
    // StatusChip コンポーネントで色分け表示する。
    renderCell: (params) => <StatusChip status={params.value as ReportStatus} />,
  },
  {
    field: 'submitted_at',
    headerName: '提出日',
    flex: 1,
    valueFormatter: (value: string | null) =>
      value ? new Date(value).toLocaleDateString('ja-JP') : '-',
  },
];

/**
 * AllReportsTable はテナント全レポートのテーブル表示を担うコンポーネント。
 * AppDataGrid / StatusChip / EmptyState / PageSkeleton 共通コンポーネントを使用する。
 */
export default function AllReportsTable({
  reports,
  loading,
  hasActiveFilters,
  onRowClick,
}: AllReportsTableProps) {
  // ローディング中は PageSkeleton（variant="table"）を表示する。
  if (loading) {
    return <PageSkeleton variant="table" />;
  }

  // データが 0 件の場合は EmptyState を表示する。フィルタ有無でメッセージを切り替える。
  if (reports.length === 0) {
    const message = hasActiveFilters
      ? '条件に一致するレポートはありません。フィルタを変更してお試しください。'
      : 'レポートはまだ作成されていません。';
    return <EmptyState message={message} />;
  }

  // AppDataGrid の rows に変換する。申請者名は submitter.name をフラットにする。
  const rows = reports.map((report) => ({
    ...report,
    submitter_name: report.submitter.name,
  })) as readonly Record<string, unknown>[];

  return (
    <AppDataGrid
      columns={COLUMNS}
      rows={rows}
      hideFooterPagination
      onRowClick={(params: GridRowParams) => onRowClick(params.row.id as string)}
      sx={{ cursor: 'pointer' }}
    />
  );
}
