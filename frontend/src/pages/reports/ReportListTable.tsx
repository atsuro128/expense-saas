// レポート一覧テーブルコンポーネント（スタブ）。
// SCR-RPT-001 に対応する。

import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
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

/**
 * ReportListTable はレポート一覧をテーブル形式で表示する。
 * 0 件のとき EmptyState を表示する。
 */
export default function ReportListTable({
  reports,
  loading = false,
  onRowClick,
  onCreateReport,
}: ReportListTableProps) {
  if (!loading && reports.length === 0) {
    return (
      <div data-testid="empty-state">
        <p>経費レポートはまだありません。レポートを作成して経費精算を始めましょう。</p>
        {onCreateReport && (
          <Button variant="contained" onClick={onCreateReport}>
            レポートを作成
          </Button>
        )}
      </div>
    );
  }

  return (
    <Table data-loading={loading}>
      <TableHead>
        <TableRow>
          <TableCell>タイトル</TableCell>
          <TableCell>対象期間</TableCell>
          <TableCell>合計金額</TableCell>
          <TableCell>ステータス</TableCell>
          <TableCell>作成日</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {reports.map((r) => (
          <TableRow
            key={r.id}
            onClick={() => onRowClick?.(r.id)}
            style={{ cursor: 'pointer' }}
          >
            <TableCell>{r.title}</TableCell>
            <TableCell>
              {r.periodStart} 〜 {r.periodEnd}
            </TableCell>
            <TableCell>{r.totalAmount.toLocaleString()}</TableCell>
            <TableCell>
              <span data-status={r.status}>{r.status}</span>
            </TableCell>
            <TableCell>{r.createdAt}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
