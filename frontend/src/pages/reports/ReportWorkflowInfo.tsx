// レポートワークフロー情報コンポーネント（スタブ）。
// 提出・承認・却下・支払情報を表示する。
// SCR-RPT-004 に対応する。

import type { ReportStatus } from '../../api/types';

export interface ReportWorkflowInfoProps {
  status: ReportStatus;
  submittedAt?: string | null;
  approverName?: string | null;
  approvedAt?: string | null;
  approvalComment?: string | null;
  rejectorName?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  paidByName?: string | null;
  paidAt?: string | null;
}

/**
 * ReportWorkflowInfo はレポートのワークフロー進捗（提出・承認・却下・支払）を表示する。
 * draft 状態ではワークフロー関連項目を非表示にする。
 */
export default function ReportWorkflowInfo({
  status,
  submittedAt,
  approverName,
  approvedAt,
  approvalComment,
  rejectorName,
  rejectedAt,
  rejectionReason,
  paidByName,
  paidAt,
}: ReportWorkflowInfoProps) {
  if (status === 'draft') {
    return null;
  }

  return (
    <div>
      {submittedAt && <p data-testid="submitted-at">提出日: {submittedAt}</p>}
      {approvedAt && (
        <div>
          <p>{approverName}</p>
          <p>{approvedAt}</p>
          {approvalComment && <p>{approvalComment}</p>}
        </div>
      )}
      {rejectedAt && (
        <div>
          <p>{rejectorName}</p>
          <p>{rejectedAt}</p>
          {rejectionReason && (
            <p data-testid="rejection-reason" style={{ backgroundColor: 'red' }}>
              {rejectionReason}
            </p>
          )}
        </div>
      )}
      {paidAt && (
        <div>
          <p>{paidByName}</p>
          <p>{paidAt}</p>
        </div>
      )}
    </div>
  );
}
