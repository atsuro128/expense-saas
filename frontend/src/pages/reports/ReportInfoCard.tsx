// レポート情報カードコンポーネント（スタブ）。
// SCR-RPT-004 に対応する。

import type { ExpenseReportDetail } from '../../api/types';

export interface ReportInfoCardProps {
  report: ExpenseReportDetail;
}

/**
 * ReportInfoCard はレポートの基本情報とワークフロー情報を表示する。
 * ReportBasicInfo と ReportWorkflowInfo をネストする。
 */
export default function ReportInfoCard({ report }: ReportInfoCardProps) {
  return (
    <div data-testid="report-info-card">
      <div data-testid="report-basic-info">
        <h2>{report.title}</h2>
        <span data-testid="status-chip">{report.status}</span>
      </div>
      <div data-testid="report-workflow-info">
        {report.submitted_at && <p>提出日: {report.submitted_at}</p>}
        {report.approved_at && <p>承認日: {report.approved_at}</p>}
      </div>
    </div>
  );
}
