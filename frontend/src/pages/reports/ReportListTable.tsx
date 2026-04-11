// レポート一覧テーブルコンポーネント。
// SCR-RPT-001 に対応する。

import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import AppDataGrid from '../../components/ui/AppDataGrid';
import StatusChip from '../../components/ui/StatusChip';
import EmptyState from '../../components/ui/EmptyState';
import type { ReportStatus } from '../../api/types';

export interface ReportListItem {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: ReportStatus;
  createdAt: string;
}

export interface ReportListTableProps {
  reports: ReportListItem[];
  loading?: boolean;
  onRowClick?: (reportId: string) => void;
  onCreateReport?: () => void;
}

/** テーブルのカラム定義。ReportListItem のフィールド名に準拠する。 */
const COLUMNS: GridColDef[] = [
  {
    field: 'title',
    headerName: 'タイトル',
    flex: 2,
  },
  {
    field: 'period',
    headerName: '対象期間',
    flex: 2,
    // periodStart〜periodEnd を結合して表示する。
    renderCell: (params) => (
      <span>{`${params.row.periodStart as string} 〜 ${params.row.periodEnd as string}`}</span>
    ),
  },
  {
    field: 'totalAmount',
    headerName: '合計金額',
    flex: 1,
    // 金額を 3 桁カンマ区切りで表示する。
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
    field: 'createdAt',
    headerName: '作成日',
    flex: 1,
    valueFormatter: (value: string) =>
      value ? new Date(value).toLocaleDateString('ja-JP') : '-',
  },
];

/**
 * ReportListTable はレポート一覧を AppDataGrid で表示する。
 * 0 件のとき EmptyState を表示する。
 */
export default function ReportListTable({
  reports,
  loading = false,
  onRowClick,
  onCreateReport,
}: ReportListTableProps) {
  // データが 0 件の場合は EmptyState を表示する。
  if (!loading && reports.length === 0) {
    return (
      <EmptyState
        message="経費レポートはまだありません。レポートを作成して経費精算を始めましょう。"
        action={
          onCreateReport
            ? { label: 'レポートを作成', onClick: onCreateReport }
            : undefined
        }
      />
    );
  }

  // AppDataGrid の rows に型変換する。
  const rows = reports as unknown as readonly Record<string, unknown>[];

  return (
    <AppDataGrid
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      hideFooterPagination
      onRowClick={
        onRowClick
          ? (params: GridRowParams) => onRowClick((params.row as { id: string }).id)
          : undefined
      }
      sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
    />
  );
}
