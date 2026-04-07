// AllReportsTable: テナント全レポートのテーブル表示を管理するコンポーネント。
// データが存在する場合はテーブルで一覧を描画し、0件の場合は EmptyState を表示する。
// ローディング中は PageSkeleton を表示する。行クリックでレポート詳細画面に遷移する。

import type { AllReportRow } from '../../api/adminTypes';

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

/** ステータスの日本語ラベルマップ。 */
const STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  submitted: '提出済み',
  approved: '承認済み',
  rejected: '却下',
  paid: '支払済み',
};

/**
 * AllReportsTable はテナント全レポートのテーブル表示を担うコンポーネント。
 */
export default function AllReportsTable({
  reports,
  loading,
  hasActiveFilters,
  onRowClick,
}: AllReportsTableProps) {
  // ローディング中は PageSkeleton を表示する（variant="table"）。
  if (loading) {
    return <div data-testid="page-skeleton-table" aria-label="読み込み中" />;
  }

  // データが 0 件の場合は EmptyState を表示する。
  if (reports.length === 0) {
    const message = hasActiveFilters
      ? '条件に一致するレポートはありません。フィルタを変更してお試しください。'
      : 'レポートはまだ作成されていません。';
    return (
      <div data-testid="empty-state">
        <p>{message}</p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>申請者名</th>
          <th>タイトル</th>
          <th>合計金額</th>
          <th>ステータス</th>
          <th>提出日</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((report) => (
          <tr
            key={report.id}
            onClick={() => onRowClick(report.id)}
            style={{ cursor: 'pointer' }}
            data-testid={`report-row-${report.id}`}
          >
            <td>{report.submitter.name}</td>
            <td>{report.title}</td>
            <td>{report.totalAmount.toLocaleString()}</td>
            <td data-testid={`status-chip-${report.status}`}>
              {STATUS_LABEL[report.status] ?? report.status}
            </td>
            <td>
              {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString('ja-JP') : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
