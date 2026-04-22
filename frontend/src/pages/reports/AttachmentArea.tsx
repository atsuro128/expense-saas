// AttachmentArea コンポーネント。
// 明細スライドパネル内の添付ファイル管理領域。
// AttachmentList と AttachmentUploader を統合する orchestration コンポーネント。
// プレビュー・ダウンロードの window.open 呼び出しは AttachmentList 内の AttachmentItemRow が担当する。
// report-detail.md §AttachmentArea に対応する。
// ATT-FE-060/062/063: AbortController による中断トースト対応（issue #108）。
// ATT-FE-072/073/075/077: 追加モードのローカル保持対応（issue #115）。

import { useState, useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import AttachmentList from './AttachmentList';
import AttachmentUploader from './AttachmentUploader';
import AppToast from '../../components/ui/AppToast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAttachments } from '../../hooks/useAttachments';
import { useDeleteAttachment } from '../../hooks/useDeleteAttachment';
import type { Attachment } from '../../api/types';

/** AttachmentArea のパネルモード（追加・編集・閲覧）。 */
export type AttachmentAreaMode = 'add' | 'edit' | 'view';

export interface AttachmentAreaProps {
  /** レポート ID */
  reportId: string;
  /** 明細 ID（明細保存後に設定される。追加モードでは null） */
  itemId: string | null;
  /** パネルモード（追加・編集・閲覧）。省略時は itemId が null なら 'add'、それ以外は 'edit' を使う。 */
  mode?: AttachmentAreaMode;
  /** アップロード・削除操作が可能か（所有者 AND status === 'draft'） */
  canModify: boolean;
  /** アップロード中状態が変化したときのコールバック（保存ボタン制御に使用） */
  onUploadingChange?: (isUploading: boolean) => void;
  /** 削除中状態が変化したときのコールバック（保存ボタン制御に使用） */
  onDeletingChange?: (isDeleting: boolean) => void;
  /** アップロードキャンセル関数を外部に公開するための ref（ItemSlidePanel のクローズ操作から呼ぶ） */
  uploadCancelRef?: MutableRefObject<(() => void) | null>;
  /** 削除キャンセル関数を外部に公開するための ref（ItemSlidePanel のクローズ操作から呼ぶ） */
  deleteCancelRef?: MutableRefObject<(() => void) | null>;
  /**
   * アップロードが中断されたときのコールバック。
   * ItemSlidePanel レベルでトーストを表示するために使用する。
   * このコールバックは AttachmentAreaContent がアンマウント後に呼ばれる場合でも
   * ItemSlidePanel（呼び出し元）は常にマウント済みのため確実に動作する（issue #108 §7-2）。
   */
  onUploadAborted?: () => void;
  /**
   * 削除が中断されたときのコールバック。
   * ItemSlidePanel レベルでトーストを表示するために使用する（issue #108 §7-2）。
   */
  onDeleteAborted?: () => void;
  /**
   * 追加モード: ファイルが保留 state に追加/削除されたときのコールバック（issue #115）。
   * ItemSlidePanel が保存時の順次アップロードで使う File 一覧を取得するために使用する。
   */
  onPendingFilesChange?: (files: File[]) => void;
}

/**
 * AttachmentAreaContent は itemId が確定した後の実際のコンテンツを描画する内部コンポーネント。
 * 編集・閲覧モード専用（mode='edit' または mode='view'）。
 * フックのルール（条件分岐前に全フックを呼ぶ）を遵守するため分離している。
 * key={itemId} により、itemId が変わるたびに再マウントされて進行中の mutation が中断される（issue #108）。
 */
function AttachmentAreaContent({
  reportId,
  itemId,
  canModify,
  onUploadingChange,
  onDeletingChange,
  uploadCancelRef,
  deleteCancelRef,
  onUploadAborted,
  onDeleteAborted,
}: {
  reportId: string;
  itemId: string;
  canModify: boolean;
  onUploadingChange?: (isUploading: boolean) => void;
  onDeletingChange?: (isDeleting: boolean) => void;
  uploadCancelRef?: MutableRefObject<(() => void) | null>;
  deleteCancelRef?: MutableRefObject<(() => void) | null>;
  onUploadAborted?: () => void;
  onDeleteAborted?: () => void;
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
  // onDeleteAborted を useDeleteAttachment に渡す（issue #108 FIX 2: useUploadAttachment と対称化）。
  // unmount 時（明細切替）の abort で onAborted が直接呼ばれ、ItemSlidePanel 側で「削除を中止しました」トーストを表示する。
  const deleteAttachment = useDeleteAttachment({ onAborted: onDeleteAborted });

  // 削除キャンセル関数を外部に公開する（deleteCancelRef 経由で ItemSlidePanel が呼ぶ）。
  useEffect(() => {
    if (deleteCancelRef) {
      deleteCancelRef.current = deleteAttachment.cancel;
    }
    return () => {
      if (deleteCancelRef) {
        deleteCancelRef.current = null;
      }
    };
  }, [deleteAttachment.cancel, deleteCancelRef]);

  // AttachmentUploader に渡すアップロードキャンセル ref（内部用フォールバック）。
  const internalUploadCancelRef = useRef<(() => void) | null>(null);
  const attachmentUploaderCancelRef = uploadCancelRef ?? internalUploadCancelRef;

  const attachments: Attachment[] = attachmentsData?.data ?? [];

  // トーストを表示するヘルパー。
  const showToast = (severity: 'success' | 'error', message: string) => {
    setToast({ open: true, severity, message });
  };

  // アップロード成功コールバック。
  const handleUploadSuccess = () => {
    showToast('success', 'ファイルをアップロードしました');
  };

  // アップロード中断コールバック。
  const handleUploadAborted = () => {
    if (onUploadAborted) {
      onUploadAborted();
    } else {
      showToast('error', 'アップロードを中止しました');
    }
  };

  // 削除ボタン押下: 確認ダイアログを表示する。
  const handleDeleteRequest = (attachmentId: string) => {
    setConfirmTargetId(attachmentId);
  };

  // 確認ダイアログの「削除する」押下: 実際に削除 API を呼び出す。
  const handleConfirmDelete = () => {
    if (confirmTargetId === null) return;
    const targetId = confirmTargetId;
    setConfirmTargetId(null);
    setDeletingId(targetId);
    onDeletingChange?.(true);
    deleteAttachment.mutate(
      { reportId, itemId, attId: targetId },
      {
        onSuccess: () => {
          setDeletingId(null);
          onDeletingChange?.(false);
          showToast('success', '添付ファイルを削除しました');
        },
        onError: (err) => {
          setDeletingId(null);
          onDeletingChange?.(false);
          if (err instanceof Error && err.name === 'AbortError') {
            if (onDeleteAborted) {
              onDeleteAborted();
            } else {
              showToast('error', '削除を中止しました');
            }
            return;
          }
          // client.ts 層でマッピング済みの err.message をそのまま使う。
          const message = err instanceof Error ? err.message : '添付ファイルの削除に失敗しました';
          showToast('error', message);
        },
      },
    );
  };

  // 確認ダイアログの「キャンセル」押下。
  const handleCancelDelete = () => {
    setConfirmTargetId(null);
  };

  return (
    <div data-testid="attachment-area">
      <AttachmentList
        attachments={attachments}
        reportId={reportId}
        itemId={itemId}
        canDelete={canModify}
        deletingId={deletingId}
        onDelete={handleDeleteRequest}
        onError={(message) => showToast('error', message)}
      />
      {canModify && (
        <AttachmentUploader
          reportId={reportId}
          itemId={itemId}
          mode="edit"
          onUploadSuccess={handleUploadSuccess}
          onUploadError={(message) => showToast('error', message)}
          onUploadAborted={handleUploadAborted}
          onUploadingChange={onUploadingChange}
          cancelRef={attachmentUploaderCancelRef}
        />
      )}
      <AppToast
        open={toast.open}
        severity={toast.severity}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
      {confirmTargetId !== null && (
        <ConfirmDialog
          open={true}
          title="添付ファイルの削除"
          message="この添付ファイルを削除しますか?"
          confirmLabel="削除する"
          confirmColor="error"
          cancelLabel="キャンセル"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
}

/**
 * AttachmentAreaAddMode は追加モード（itemId=null）専用のコンテンツを描画する内部コンポーネント。
 * API を呼ばずに AttachmentUploader 内のローカル state でファイルを保留し、
 * 保存時にまとめてアップロードする。
 * 保留ファイルの一覧・削除ボタンは AttachmentUploader が担当する（issue #115）。
 */
function AttachmentAreaAddMode({
  reportId,
  canModify,
  onPendingFilesChange,
}: {
  reportId: string;
  canModify: boolean;
  onPendingFilesChange?: (files: File[]) => void;
}) {
  return (
    <div data-testid="attachment-area">
      {/* ファイル選択 UI（canModify=true のときのみ表示）。
          保留ファイルの一覧・削除ボタン・「保存後にアップロード予定」ラベルは
          AttachmentUploader 内部で管理する（ATT-FE-073/075/077）。 */}
      {canModify && (
        <AttachmentUploader
          reportId={reportId}
          itemId={null}
          mode="add"
          onUploadSuccess={() => {
            // 追加モードでは即時アップロードしないため呼ばれないが、型互換のために空実装。
          }}
          onPendingFilesChange={onPendingFilesChange}
        />
      )}
    </div>
  );
}

/**
 * AttachmentArea は明細スライドパネル内の添付ファイル管理領域を提供する。
 *
 * mode='add'（追加モード）: itemId=null でも表示する。ファイルはローカル state に保留し、
 *   保存時に ItemSlidePanel が順次アップロードを行う（issue #115）。
 *
 * mode='edit'（編集モード）: 既存の即時保存方式を維持する（issue #114）。
 *   key={itemId} で itemId が変わるたびに AttachmentAreaContent を再マウントして
 *   進行中の mutation が中断される（issue #108 課題 1、§7-2）。
 *
 * mode='view'（閲覧モード）: 添付一覧のみ表示（操作不可）。
 */
export default function AttachmentArea({
  reportId,
  itemId,
  mode,
  canModify,
  onUploadingChange,
  onDeletingChange,
  uploadCancelRef,
  deleteCancelRef,
  onUploadAborted,
  onDeleteAborted,
  onPendingFilesChange,
}: AttachmentAreaProps) {
  if (mode === 'add') {
    // 追加モード（明示的に mode="add" が渡された場合のみ）: itemId=null でも表示し、ローカル保持方式を使う。
    return (
      <AttachmentAreaAddMode
        reportId={reportId}
        canModify={canModify}
        onPendingFilesChange={onPendingFilesChange}
      />
    );
  }

  if (itemId === null) {
    // mode="add" 以外で itemId が null の場合は何も描画しない（後方互換 + 防衛的処理）。
    return null;
  }

  return (
    <AttachmentAreaContent
      key={itemId}
      reportId={reportId}
      itemId={itemId}
      canModify={canModify}
      onUploadingChange={onUploadingChange}
      onDeletingChange={onDeletingChange}
      uploadCancelRef={uploadCancelRef}
      deleteCancelRef={deleteCancelRef}
      onUploadAborted={onUploadAborted}
      onDeleteAborted={onDeleteAborted}
    />
  );
}
