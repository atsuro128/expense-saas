// AttachmentArea コンポーネント。
// 明細スライドパネル内の添付ファイル管理領域。
// AttachmentList と AttachmentUploader を統合する。
// report-detail.md §AttachmentArea に対応する。

import { useState } from 'react';
import AttachmentList from './AttachmentList';
import AttachmentUploader from './AttachmentUploader';
import AppToast from '../../components/ui/AppToast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAttachments } from '../../hooks/useAttachments';
import { useDeleteAttachment } from '../../hooks/useDeleteAttachment';
import type { ApiResponse, Attachment } from '../../api/types';
import { api } from '../../api/client';

export interface AttachmentAreaProps {
  /** レポート ID */
  reportId: string;
  /** 明細 ID（明細保存後に設定される。未保存の追加モードでは null） */
  itemId: string | null;
  /** アップロード・削除操作が可能か（所有者 AND status === 'draft'） */
  canModify: boolean;
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

  // ダウンロードコールバック。署名付き URL を取得してブラウザでダウンロードを開始する。
  const handleDownload = async (attachmentId: string) => {
    try {
      const res = await api.get<ApiResponse<{ download_url: string; file_name: string }>>(
        `/api/reports/${reportId}/items/${itemId}/attachments/${attachmentId}`,
      );
      const link = document.createElement('a');
      link.href = res.data.download_url;
      link.download = res.data.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      showToast('error', 'ダウンロードに失敗しました');
    }
  };

  // 削除ボタン押下: 確認ダイアログを表示する（report-detail.md §4.6 準拠）。
  const handleDelete = (attachmentId: string) => {
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
      <AttachmentList
        attachments={attachments}
        canDelete={canModify}
        onDownload={(id) => {
          void handleDownload(id);
        }}
        onDelete={handleDelete}
        deletingId={deletingId}
      />
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
