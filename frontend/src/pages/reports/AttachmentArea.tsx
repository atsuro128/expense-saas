// AttachmentArea コンポーネント。
// 明細スライドパネル内の添付ファイル管理領域。
// AttachmentList と AttachmentUploader を統合する orchestration コンポーネント。
// プレビュー・ダウンロードの window.open 呼び出しは AttachmentItemRow が担当する。
// report-detail.md §AttachmentArea に対応する。

import { useState } from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AttachmentUploader from './AttachmentUploader';
import AppToast from '../../components/ui/AppToast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAttachments } from '../../hooks/useAttachments';
import { useAttachmentDownloadUrl } from '../../hooks/useAttachmentDownloadUrl';
import { useAttachmentPreviewUrl } from '../../hooks/useAttachmentPreviewUrl';
import { useDeleteAttachment } from '../../hooks/useDeleteAttachment';
import { formatFileSize } from '../../lib/format';
import type { Attachment } from '../../api/types';

export interface AttachmentAreaProps {
  /** レポート ID */
  reportId: string;
  /** 明細 ID（明細保存後に設定される。未保存の追加モードでは null） */
  itemId: string | null;
  /** アップロード・削除操作が可能か（所有者 AND status === 'draft'） */
  canModify: boolean;
}

/** AttachmentItemRow が親コンポーネントにトーストを通知するためのコールバック型。 */
interface AttachmentItemRowCallbacks {
  /** エラー発生時にエラーメッセージを通知する。 */
  onError: (message: string) => void;
  /** 削除ボタン押下時に対象 ID を通知する（確認ダイアログ表示のトリガー）。 */
  onDeleteRequest: (attachmentId: string) => void;
}

/** AttachmentItemRow の Props。 */
interface AttachmentItemRowProps extends AttachmentItemRowCallbacks {
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
}

/**
 * AttachmentItemRow は添付ファイル 1 件分の行を描画する内部コンポーネント。
 * useAttachmentDownloadUrl・useAttachmentPreviewUrl を per-item で保持し、
 * クリック時に refetch() を呼んで署名付き URL を取得する（enabled: false + 明示的 refetch 方式）。
 * window.open('about:blank', '_blank') をクリック同期で先に開き、URL 取得後に差し替える
 * パターン（files.md §4.5）を実装する。
 * フックのルール（ループ・条件分岐内での hook 呼び出し禁止）を遵守するため、
 * 添付 1 件ごとにコンポーネントを分割してトップレベルで hook を呼ぶ。
 */
function AttachmentItemRow({
  reportId,
  itemId,
  attachment,
  canDelete,
  deletingId,
  onError,
  onDeleteRequest,
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
   * プレビューと同じクリック同期パターンを採用する。
   * 署名付き URL の Content-Disposition: attachment により、ブラウザがダウンロードを開始する。
   */
  const handleDownload = () => {
    // クリック同期で空タブを先に開く（ポップアップブロック回避）。
    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      onError('ポップアップがブロックされました。ブラウザ設定を確認してください');
      return;
    }
    refetchDownload()
      .then((res) => {
        if (res.data?.data.url) {
          newWindow.location.href = res.data.data.url;
        } else {
          newWindow.close();
          onError('ダウンロードの取得に失敗しました');
        }
      })
      .catch(() => {
        newWindow.close();
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
          onClick={() => onDeleteRequest(attachment.id)}
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
 * AttachmentAreaContent は itemId が確定した後の実際のコンテンツを描画する内部コンポーネント。
 * フックのルール（条件分岐前に全フックを呼ぶ）を遵守するため分離している。
 */
function AttachmentAreaContent({
  reportId,
  itemId,
  canModify,
}: {
  reportId: string;
  itemId: string;
  canModify: boolean;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 確認ダイアログ用の状態: 削除対象の添付ファイル ID を保持する（null のとき非表示）。
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    severity: 'success' | 'error';
    message: string;
  }>({ open: false, severity: 'success', message: '' });

  // 添付ファイル一覧を取得する。
  const { data: attachmentsData } = useAttachments({ reportId, itemId });
  const deleteAttachment = useDeleteAttachment();

  const attachments: Attachment[] = attachmentsData?.data ?? [];

  // トーストを表示するヘルパー。
  const showToast = (severity: 'success' | 'error', message: string) => {
    setToast({ open: true, severity, message });
  };

  // アップロード成功コールバック。キャッシュの無効化は useUploadAttachment Hook が担当する。
  const handleUploadSuccess = () => {
    showToast('success', 'ファイルをアップロードしました');
  };

  // 削除ボタン押下: 確認ダイアログを表示する（report-detail.md §4.6 準拠）。
  const handleDeleteRequest = (attachmentId: string) => {
    setConfirmTargetId(attachmentId);
  };

  // 確認ダイアログの「削除する」押下: 実際に削除 API を呼び出す。
  const handleConfirmDelete = () => {
    if (confirmTargetId === null) return;
    const targetId = confirmTargetId;
    setConfirmTargetId(null);
    setDeletingId(targetId);
    deleteAttachment.mutate(
      { reportId, itemId, attId: targetId },
      {
        onSuccess: () => {
          setDeletingId(null);
          showToast('success', '添付ファイルを削除しました');
        },
        onError: () => {
          setDeletingId(null);
          showToast('error', '削除に失敗しました');
        },
      },
    );
  };

  // 確認ダイアログの「キャンセル」押下: ダイアログを閉じるだけで何もしない。
  const handleCancelDelete = () => {
    setConfirmTargetId(null);
  };

  return (
    <div data-testid="attachment-area">
      {/* 添付ファイル一覧。各行は per-item hook を持つ AttachmentItemRow が担当する。 */}
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
                canDelete={canModify}
                deletingId={deletingId}
                onError={(message) => showToast('error', message)}
                onDeleteRequest={handleDeleteRequest}
              />
            ))}
          </ul>
        )}
      </div>
      {canModify && (
        <AttachmentUploader
          reportId={reportId}
          itemId={itemId}
          onUploadSuccess={handleUploadSuccess}
          onUploadError={(message) => showToast('error', message)}
        />
      )}
      <AppToast
        open={toast.open}
        severity={toast.severity}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
      {/* 添付削除の確認ダイアログ（screens.md §4.6 準拠） */}
      <ConfirmDialog
        open={confirmTargetId !== null}
        title="添付ファイルの削除"
        message="この添付ファイルを削除しますか?"
        confirmLabel="削除する"
        confirmColor="error"
        cancelLabel="キャンセル"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

/**
 * AttachmentArea は明細スライドパネル内の添付ファイル管理領域を提供する。
 * itemId が null の場合（追加モードで未保存）は非表示にする。
 */
export default function AttachmentArea({
  reportId,
  itemId,
  canModify,
}: AttachmentAreaProps) {
  // itemId が null の場合は何も描画しない（追加モード・未保存）。
  if (itemId === null) {
    return null;
  }

  return (
    <AttachmentAreaContent
      reportId={reportId}
      itemId={itemId}
      canModify={canModify}
    />
  );
}
