// AttachmentList コンポーネント。
// 添付ファイル一覧を表示する。各ファイルの per-item hook orchestration も担当する。
// report-detail.md §AttachmentList に対応する。
// プレビューは window.open('about:blank', '_blank') パターン（AttachmentItemRow が担当）。
// ダウンロードは動的 <a download> 要素クリックパターン（タブを開かない）。
// hook rule 違反を避けるため、per-item で AttachmentItemRow コンポーネントに分割する。

import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useAttachmentDownloadUrl } from '../../hooks/useAttachmentDownloadUrl';
import { useAttachmentPreviewUrl } from '../../hooks/useAttachmentPreviewUrl';
import { formatFileSize } from '../../lib/format';
import type { Attachment } from '../../api/types';

export interface AttachmentListProps {
  /** 添付ファイルデータ配列 */
  attachments: Attachment[];
  /** レポート ID（per-item hook 呼び出しに使用） */
  reportId: string;
  /** 明細 ID（per-item hook 呼び出しに使用） */
  itemId: string;
  /** 削除ボタンを表示するか（所有者 AND draft 状態の場合のみ） */
  canDelete: boolean;
  /** 削除処理中の添付 ID（グレーアウト対象） */
  deletingId: string | null;
  /** 削除ボタン押下コールバック（確認ダイアログ表示は AttachmentArea が担当） */
  onDelete: (attachmentId: string) => void;
  /** エラー発生時のコールバック（AppToast 表示は AttachmentArea が担当） */
  onError: (message: string) => void;
}

/** AttachmentItemRow の Props。 */
interface AttachmentItemRowProps {
  /** レポート ID。 */
  reportId: string;
  /** 明細 ID。 */
  itemId: string;
  /** 添付ファイルデータ。 */
  attachment: Attachment;
  /** 削除ボタンを表示するか（所有者 AND draft 状態の場合のみ）。 */
  canDelete: boolean;
  /** 削除処理中の添付 ID（グレーアウト対象）。 */
  deletingId: string | null;
  /** 削除ボタン押下コールバック。 */
  onDelete: (attachmentId: string) => void;
  /** エラー発生時のコールバック。 */
  onError: (message: string) => void;
}

/**
 * AttachmentItemRow は添付ファイル 1 件分の行を描画する内部コンポーネント。
 * useAttachmentDownloadUrl・useAttachmentPreviewUrl を per-item で保持し、
 * クリック時に refetch() を呼んで署名付き URL を取得する（enabled: false + 明示的 refetch 方式）。
 * プレビューは window.open('about:blank', '_blank') → location.href 差し替えパターン（files.md §4.5）。
 * ダウンロードは動的 <a download> 要素クリックパターン（タブを開かない）。
 * フックのルール（ループ・条件分岐内での hook 呼び出し禁止）を遵守するため、
 * 添付 1 件ごとにコンポーネントを分割してトップレベルで hook を呼ぶ。
 */
function AttachmentItemRow({
  reportId,
  itemId,
  attachment,
  canDelete,
  deletingId,
  onDelete,
  onError,
}: AttachmentItemRowProps) {
  // ダウンロード URL 取得 Hook（enabled: false・クリック時に refetch）。
  const { refetch: refetchDownload } = useAttachmentDownloadUrl({
    reportId,
    itemId,
    attId: attachment.id,
  });

  // プレビュー URL 取得 Hook（enabled: false・クリック時に refetch）。
  const { refetch: refetchPreview } = useAttachmentPreviewUrl({
    reportId,
    itemId,
    attId: attachment.id,
  });

  /**
   * プレビューハンドラ。
   * ポップアップブロック回避のため、クリック同期で空タブを先に開き、
   * 非同期で署名付き URL を取得後に location を差し替える。
   * files.md §4.5 のパターンに準拠。
   */
  const handlePreview = () => {
    // クリック同期で空タブを先に開く（ポップアップブロック回避）。
    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      onError('ポップアップがブロックされました。ブラウザ設定を確認してください');
      return;
    }
    refetchPreview()
      .then((res) => {
        if (res.data?.data.url) {
          newWindow.location.href = res.data.data.url;
        } else {
          newWindow.close();
          onError('プレビューの取得に失敗しました');
        }
      })
      .catch(() => {
        newWindow.close();
        onError('プレビューの取得に失敗しました');
      });
  };

  /**
   * ダウンロードハンドラ。
   * 動的 <a download> 要素クリックによるダウンロード（タブを開かない）。
   * refetch() で署名付き URL を取得後、動的生成した <a> 要素の href に URL、
   * download 属性にファイル名を設定し、DOM 追加 → click() → 削除を順に実行する。
   * 失敗時は onError コールバックでエラートーストを表示する。
   */
  const handleDownload = () => {
    refetchDownload()
      .then((res) => {
        if (res.data?.data.url) {
          // 動的 <a download> 要素を生成してクリック（タブを開かずダウンロードを起動）。
          const link = document.createElement('a');
          link.href = res.data.data.url;
          link.download = res.data.data.file_name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          onError('ダウンロードの取得に失敗しました');
        }
      })
      .catch(() => {
        onError('ダウンロードの取得に失敗しました');
      });
  };

  const isDisabled = deletingId === attachment.id;

  return (
    <li data-testid={`attachment-item-${attachment.id}`}>
      <Button
        variant="text"
        size="small"
        onClick={handlePreview}
        disabled={isDisabled}
        data-testid={`attachment-preview-${attachment.id}`}
      >
        {attachment.file_name}
      </Button>
      {/* ↓ アイコンはダウンロード専用。プレビューとダウンロードを明確に分離する。 */}
      <IconButton
        size="small"
        aria-label="ダウンロード"
        onClick={handleDownload}
        disabled={isDisabled}
        data-testid={`attachment-download-${attachment.id}`}
      >
        <FileDownloadIcon fontSize="small" />
      </IconButton>
      <span data-testid={`attachment-size-${attachment.id}`}>
        {formatFileSize(attachment.file_size)}
      </span>
      {canDelete && (
        <Button
          variant="text"
          size="small"
          color="error"
          onClick={() => onDelete(attachment.id)}
          disabled={isDisabled}
          data-testid={`attachment-delete-${attachment.id}`}
        >
          削除
        </Button>
      )}
    </li>
  );
}

/**
 * AttachmentList は添付ファイル一覧を表示する。
 * 各ファイルにファイル名（クリックでプレビュー）、↓ アイコン（クリックでダウンロード）、
 * ファイルサイズ、削除ボタンを表示する。
 * 空の場合は空状態メッセージを表示する。
 * data-testid="attachment-list" は常に描画され、内部に空状態または一覧を表示する。
 * per-item の hook orchestration（プレビュー・ダウンロード）は AttachmentItemRow が担当する。
 */
export default function AttachmentList({
  attachments,
  reportId,
  itemId,
  canDelete,
  deletingId,
  onDelete,
  onError,
}: AttachmentListProps) {
  return (
    <div data-testid="attachment-list">
      {attachments.length === 0 ? (
        <div data-testid="attachment-list-empty">添付ファイルはありません</div>
      ) : (
        <ul>
          {attachments.map((att) => (
            <AttachmentItemRow
              key={att.id}
              reportId={reportId}
              itemId={itemId}
              attachment={att}
              canDelete={canDelete}
              deletingId={deletingId}
              onDelete={onDelete}
              onError={onError}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
