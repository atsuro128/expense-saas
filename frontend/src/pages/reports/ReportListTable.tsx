// レポート一覧テーブルコンポーネント（スタブ）。
// SCR-RPT-001 に対応する。

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
          <button type="button" onClick={onCreateReport}>
            レポートを作成
          </button>
        )}
      </div>
    );
  }

  return (
    <table data-loading={loading}>
      <thead>
        <tr>
          <th>タイトル</th>
          <th>対象期間</th>
          <th>合計金額</th>
          <th>ステータス</th>
          <th>作成日</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((r) => (
          <tr
            key={r.id}
            onClick={() => onRowClick?.(r.id)}
            style={{ cursor: 'pointer' }}
          >
            <td>{r.title}</td>
            <td>
              {r.periodStart} 〜 {r.periodEnd}
            </td>
            <td>{r.totalAmount.toLocaleString()}</td>
            <td>
              <span data-status={r.status}>{r.status}</span>
            </td>
            <td>{r.createdAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
