// AttachmentArea コンポーネント（スタブ）。
// 明細スライドパネル内の添付ファイル管理領域。
// AttachmentList と AttachmentUploader を統合する。
// report-detail.md §AttachmentArea に対応する。

export interface AttachmentAreaProps {
  /** レポート ID */
  reportId: string;
  /** 明細 ID（明細保存後に設定される。未保存の追加モードでは null） */
  itemId: string | null;
  /** アップロード・削除操作が可能か（所有者 AND status === 'draft'） */
  canModify: boolean;
}

/**
 * AttachmentArea は明細スライドパネル内の添付ファイル管理領域を提供する。
 * itemId が null の場合（追加モードで未保存）は非表示にする。
 */
export default function AttachmentArea({
  reportId: _reportId,
  itemId,
  canModify: _canModify,
}: AttachmentAreaProps) {
  // _reportId・_canModify は機能実装時に使用する（スタブでは未使用）。

  if (itemId === null) {
    return null;
  }

  return (
    <div data-testid="attachment-area">
      {/* AttachmentList / AttachmentUploader は機能実装で追加される */}
      <div data-testid="attachment-area-content" />
    </div>
  );
}
