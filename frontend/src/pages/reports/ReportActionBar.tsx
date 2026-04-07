// レポートアクションバーコンポーネント（スタブ）。
// OwnerActions と WorkflowActions を条件によって表示する。
// SCR-RPT-004 に対応する。

import type { ReportStatus } from '../../api/types';
import OwnerActions from './OwnerActions';

export interface ReportActionBarProps {
  status: ReportStatus;
  isOwner: boolean;
  currentUserRole: string;
  itemCount?: number;
  pendingAction?: string | null;
  onEdit?: () => void;
  onSubmitReport?: () => void;
  onDelete?: () => void;
  onResubmit?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onPay?: () => void;
}

/**
 * ReportActionBar はレポートの状態・ロール・所有権に応じたアクションボタンを表示する。
 * - 所有者: OwnerActions を表示
 * - 非所有者 + Approver + submitted: WorkflowActions を表示
 * - 非所有者 + Accounting + approved: WorkflowActions（支払ボタン）を表示
 * - paid: 何も表示しない（終端状態）
 */
export default function ReportActionBar({
  status,
  isOwner,
  currentUserRole,
  itemCount = 0,
  pendingAction = null,
  onEdit,
  onSubmitReport,
  onDelete,
  onResubmit,
  onApprove,
  onReject,
  onPay,
}: ReportActionBarProps) {
  // 終端状態では何も表示しない
  if (status === 'paid') {
    return null;
  }

  // 所有者のアクション
  if (isOwner && (status === 'draft' || status === 'rejected')) {
    return (
      <OwnerActions
        status={status}
        itemCount={itemCount}
        pendingAction={pendingAction as 'submit' | 'delete' | null}
        onEdit={onEdit}
        onSubmitReport={onSubmitReport}
        onDelete={onDelete}
        onResubmit={onResubmit}
      />
    );
  }

  // 非所有者の承認者アクション（submitted 状態、自己承認禁止: RBC-016）
  if (!isOwner && currentUserRole === 'approver' && status === 'submitted') {
    return (
      <div data-testid="workflow-actions">
        <button type="button" onClick={onApprove} disabled={pendingAction !== null}>
          承認
        </button>
        <button type="button" onClick={onReject} disabled={pendingAction !== null}>
          却下
        </button>
      </div>
    );
  }

  // 非所有者の経理アクション（approved 状態）
  if (!isOwner && currentUserRole === 'accounting' && status === 'approved') {
    return (
      <div data-testid="workflow-actions">
        <button type="button" onClick={onPay} disabled={pendingAction !== null}>
          支払完了
        </button>
      </div>
    );
  }

  return null;
}
