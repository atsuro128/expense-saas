// レポートオーナー操作ボタングループコンポーネント（スタブ）。
// 所有者が実行できる操作（編集・提出・削除・再申請）を表示する。
// SCR-RPT-004 に対応する。

import type { ReportStatus } from '../../api/types';

export interface OwnerActionsProps {
  status: ReportStatus;
  itemCount?: number;
  pendingAction?: 'submit' | 'delete' | null;
  onEdit?: () => void;
  onSubmitReport?: () => void;
  onDelete?: () => void;
  onResubmit?: () => void;
}

/**
 * OwnerActions はレポート所有者が実行できる操作ボタンを表示する。
 * ステータスによって表示するボタンが変わる。
 */
export default function OwnerActions({
  status,
  itemCount = 0,
  pendingAction = null,
  onEdit,
  onSubmitReport,
  onDelete,
  onResubmit,
}: OwnerActionsProps) {
  if (status === 'draft') {
    const isSubmitDisabled = itemCount === 0 || pendingAction !== null;
    const isDeleteDisabled = pendingAction !== null;
    const isEditDisabled = pendingAction !== null;

    return (
      <div>
        <button type="button" onClick={onEdit} disabled={isEditDisabled}>
          編集
        </button>
        <button
          type="button"
          onClick={onSubmitReport}
          disabled={isSubmitDisabled}
          title={itemCount === 0 ? '明細を追加してください' : undefined}
        >
          {pendingAction === 'submit' ? (
            <>
              <span data-testid="spinner" />
              提出
            </>
          ) : (
            '提出'
          )}
        </button>
        <button type="button" onClick={onDelete} disabled={isDeleteDisabled}>
          削除
        </button>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div>
        <button type="button" onClick={onResubmit}>
          再申請
        </button>
      </div>
    );
  }

  // submitted / approved / paid の場合は操作ボタンなし
  return null;
}
