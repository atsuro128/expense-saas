// WorkflowActions コンポーネントのスタブ実装。
// レポート詳細画面（SCR-RPT-004）に表示するワークフロー操作ボタン。
// Approver には「承認」「却下」ボタン、Accounting には「支払完了」ボタンを表示する。
// 本実装は Step10 で行う。現時点はスタブ（何も描画しない）。

import type { ReportStatus, Role } from '../../api/types';

export interface WorkflowActionsProps {
  /** レポートの現在のステータス */
  status: ReportStatus;
  /** 現在のユーザーのロール */
  currentUserRole: Role;
  /** 承認ボタンのコールバック */
  onApprove?: () => void;
  /** 却下ボタンのコールバック */
  onReject?: () => void;
  /** 支払完了ボタンのコールバック */
  onMarkAsPaid?: () => void;
  /** ローディング中のアクション名（"approve" | "reject" | "pay" | null） */
  pendingAction?: 'approve' | 'reject' | 'pay' | null;
}

/**
 * WorkflowActions はレポートに対するワークフロー操作ボタンを表示する。
 * スタブ実装のため、何も描画しない。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function WorkflowActions(_props: WorkflowActionsProps) {
  // スタブ: Step10 で実装する。
  return null;
}
