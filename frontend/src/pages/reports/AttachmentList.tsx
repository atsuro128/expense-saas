// AttachmentList コンポーネント。
// 添付ファイル一覧を表示し、ダウンロードと削除操作を提供する。
// report-detail.md §AttachmentList に対応する。

import Button from '@mui/material/Button';
import type { Attachment } from '../../api/types';

export interface AttachmentListProps {
  /** 添付ファイルデータ配列 */
  attachments: Attachment[];
  /** 削除ボタンを表示するか（所有者 AND draft 状態の場合のみ） */
  canDelete: boolean;
  /** ファイル名クリック（ダウンロード）コールバック */
  onDownload: (attachmentId: string) => void;
  /** 削除ボタン押下コールバック */
  onDelete: (attachmentId: string) => void;
  /** 削除処理中の添付 ID（グレーアウト対象） */
  deletingId: string | null;
}

/**
 * AttachmentList は添付ファイル一覧を表示する。
 * 各ファイルのファイル名（クリックでダウンロード）、ファイルサイズ、削除ボタンを表示する。
 * 空の場合は空状態メッセージを表示する。
 * data-testid="attachment-list" は常に描画され、内部に空状態または一覧を表示する。
 */
export default function AttachmentList({
  attachments,
  canDelete,
  onDownload,
  onDelete,
  deletingId,
}: AttachmentListProps) {
  return (
    <div data-testid="attachment-list">
      {attachments.length === 0 ? (
        <div data-testid="attachment-list-empty">添付ファイルはありません</div>
      ) : (
        <ul>
          {attachments.map((att) => (
            <li key={att.id} data-testid={`attachment-item-${att.id}`}>
              <Button
                variant="text"
                size="small"
                onClick={() => onDownload(att.id)}
                disabled={deletingId === att.id}
                data-testid={`attachment-download-${att.id}`}
              >
                {att.file_name}
              </Button>
              <span data-testid={`attachment-size-${att.id}`}>
                {att.file_size}
              </span>
              {canDelete && (
                <Button
                  variant="text"
                  size="small"
                  color="error"
                  onClick={() => onDelete(att.id)}
                  disabled={deletingId === att.id}
                  data-testid={`attachment-delete-${att.id}`}
                >
                  削除
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
