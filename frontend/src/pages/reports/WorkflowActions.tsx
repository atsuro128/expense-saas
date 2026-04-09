// WorkflowActions コンポーネント。
// レポート詳細画面（SCR-RPT-004）に表示するワークフロー操作ボタン。
// Approver には「承認」「却下」ボタン、Accounting には「支払完了」ボタンを表示する。
// authz.md §6 のロール別認可に準拠する。

import type { ReportStatus, Role } from '../../api/types';

export interface WorkflowActionsProps {
  /** レポートの現在のステータス */
  status: ReportStatus;
  /** 現在のユーザーのロール */
  currentUserRole: Role;
  /** レポートの作成者かどうか（自己承認・自己支払禁止用） */
  isOwner: boolean;
  /** 承認ボタンのコールバック */
  onApprove: () => void;
  /** 却下ボタンのコールバック */
  onReject: () => void;
  /** 支払完了ボタンのコールバック */
  onMarkAsPaid: () => void;
  /** ローディング中のアクション名（"approve" | "reject" | "pay" | null） */
  pendingAction: 'approve' | 'reject' | 'pay' | null;
}

/**
 * WorkflowActions はレポートに対するワークフロー操作ボタンを表示する。
 * Approver は status=submitted のときに「承認」「却下」ボタンを表示する。
 * Accounting は status=approved のときに「支払完了」ボタンを表示する。
 */
export default function WorkflowActions({
  status,
  currentUserRole,
  isOwner,
  onApprove,
  onReject,
  onMarkAsPaid,
  pendingAction,
}: WorkflowActionsProps) {
  // 自己承認・自己支払禁止: オーナー自身にはワークフロー操作ボタンを表示しない。
  if (isOwner) {
    return null;
  }

  // Approver かつ提出済みのとき「承認」「却下」ボタンを表示する。
  if (currentUserRole === 'approver' && status === 'submitted') {
    const isApproving = pendingAction === 'approve';
    const isRejecting = pendingAction === 'reject';
    const isBusy = pendingAction !== null;

    return (
      <div>
        <button
          type="button"
          data-testid="approve-button"
          onClick={onApprove}
          disabled={isBusy}
        >
          {isApproving && <span data-testid="approve-spinner" />}
          承認
        </button>
        <button
          type="button"
          data-testid="reject-button"
          onClick={onReject}
          disabled={isBusy}
        >
          {isRejecting && <span data-testid="reject-spinner" />}
          却下
        </button>
      </div>
    );
  }

  // Accounting かつ承認済みのとき「支払完了」ボタンを表示する。
  if (currentUserRole === 'accounting' && status === 'approved') {
    const isPaying = pendingAction === 'pay';

    return (
      <div>
        <button
          type="button"
          data-testid="pay-button"
          onClick={onMarkAsPaid}
          disabled={pendingAction !== null}
        >
          {isPaying && <span data-testid="pay-spinner" />}
          支払完了
        </button>
      </div>
    );
  }

  // それ以外のロール・ステータスの組み合わせでは何も表示しない。
  return null;
}
