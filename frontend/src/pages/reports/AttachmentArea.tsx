// AttachmentArea コンポーネント。
// 明細スライドパネル内の添付ファイル管理領域。
// AttachmentList と AttachmentUploader を統合する orchestration コンポーネント。
// プレビュー・ダウンロードの window.open 呼び出しは AttachmentList 内の AttachmentItemRow が担当する。
// report-detail.md §AttachmentArea に対応する。
// ATT-FE-060/062/063: AbortController による中断トースト対応（issue #108）。
// ATT-FE-072/073/075/077: 追加モードのローカル保持対応（issue #115）。
// #156/#159: 添付削除ダイアログに apiError パターンを適用（エラー時はダイアログ open 維持 + FormAlert 表示）。

import { useState, useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import AttachmentList from './AttachmentList';
import AttachmentUploader from './AttachmentUploader';
import AppToast from '../../components/ui/AppToast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAttachments } from '../../hooks/useAttachments';
import { useDeleteAttachment } from '../../hooks/useDeleteAttachment';
import { ATTACHMENT_UPLOAD_SUCCESS, ATTACHMENT_DELETE_SUCCESS } from '../../lib/constants';
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
  /**
   * 追加モード専用: AttachmentAreaAddMode の再マウントキー（issue #132 codex blocker）。
   * 保存成功・破棄時に ItemSlidePanel がインクリメントし、AttachmentAreaAddMode を再マウントすることで
   * AttachmentUploader 内部の pendingFiles state（UI 上の保留ファイル行）をクリアする。
   * edit/view モードの AttachmentAreaContent には影響しない。
   */
  addModeResetKey?: number;
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
  // 添付削除ダイアログ専用の API エラー state（#156/#159 対応）。
  // 削除 API エラー時にダイアログを open のまま apiError を表示する。
  const [deleteDialogApiError, setDeleteDialogApiError] = useState<string | null>(null);
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

  // アップロード成功コールバック（edit モード）。共通定数を使用する（issue #143）。
  const handleUploadSuccess = () => {
    showToast('success', ATTACHMENT_UPLOAD_SUCCESS);
  };

  // アップロード中断コールバック。
  const handleUploadAborted = () => {
    if (onUploadAborted) {
      onUploadAborted();
    } else {
      showToast('error', 'アップロードを中止しました');
    }
  };

  // 削除ボタン押下: 確認ダイアログを表示し、前回の apiError をクリアする。
  const handleDeleteRequest = (attachmentId: string) => {
    setDeleteDialogApiError(null);
    setConfirmTargetId(attachmentId);
  };

  // 確認ダイアログの「削除する」押下: 実際に削除 API を呼び出す。
  // #156/#159 対応: ダイアログを即時閉じずに API を呼ぶ。
  // 成功時にダイアログを閉じ、エラー時は open 維持 + apiError を表示する。
  const handleConfirmDelete = () => {
    if (confirmTargetId === null) return;
    const targetId = confirmTargetId;
    setDeletingId(targetId);
    onDeletingChange?.(true);
    deleteAttachment.mutate(
      { reportId, itemId, attId: targetId },
      {
        onSuccess: () => {
          setDeletingId(null);
          onDeletingChange?.(false);
          // 成功時にダイアログを閉じる。
          setConfirmTargetId(null);
          setDeleteDialogApiError(null);
          // 共通定数を使用する（issue #143、add モードと文言を統一）。
          showToast('success', ATTACHMENT_DELETE_SUCCESS);
        },
        onError: (err) => {
          setDeletingId(null);
          onDeletingChange?.(false);
          if (err instanceof Error && err.name === 'AbortError') {
            // AbortError: ダイアログを閉じてアボートトーストを表示する。
            setConfirmTargetId(null);
            setDeleteDialogApiError(null);
            if (onDeleteAborted) {
              onDeleteAborted();
            } else {
              showToast('error', '削除を中止しました');
            }
            return;
          }
          // その他のエラー: ダイアログを open 維持 + apiError を set する。
          // client.ts 層でマッピング済みの err.message をそのまま使う。
          const message = err instanceof Error ? err.message : '添付ファイルの削除に失敗しました';
          setDeleteDialogApiError(message);
        },
      },
    );
  };

  // 確認ダイアログの「キャンセル」押下。
  const handleCancelDelete = () => {
    setDeleteDialogApiError(null);
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
      {/* 添付削除確認ダイアログ。
          #156/#159 対応: エラー時はダイアログを open 維持 + apiError を FormAlert で表示する。 */}
      {confirmTargetId !== null && (
        <ConfirmDialog
          open={true}
          title="添付ファイルの削除"
          message="この添付ファイルを削除しますか?"
          confirmLabel="削除する"
          confirmColor="error"
          cancelLabel="キャンセル"
          apiError={deleteDialogApiError}
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
 * 保留ファイルの一覧・プレビューボタン・削除ボタンは AttachmentUploader が担当する
 * （issue #115 ローカル保持方式、issue #129 プレビュー対応）。
 * issue #143: 保留完了時と削除完了時に編集モードと同一文言のトーストを発火する（案 A）。
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
  // add モード用トースト state（issue #143: 編集モードと同一文言でトーストを発火する）。
  const [toast, setToast] = useState<{
    open: boolean;
    severity: 'success' | 'error';
    message: string;
  }>({ open: false, severity: 'success', message: '' });

  // トーストを表示するヘルパー。
  const showToast = (severity: 'success' | 'error', message: string) => {
    setToast({ open: true, severity, message });
  };

  // 保留ファイル追加完了時のコールバック（issue #143、案 A）。
  // add モードのトリガは Hook の onSuccess ではなく、ここで直接トーストをトリガする。
  // 編集モードと完全同一の文言「ファイルをアップロードしました」を使用する。
  const handlePendingFileAddedSuccess = () => {
    showToast('success', ATTACHMENT_UPLOAD_SUCCESS);
  };

  // 保留ファイル削除完了時のコールバック（issue #143、案 A）。
  // 確認ダイアログなし・API 呼び出しなしのローカル state からの除去後にトーストを発火する。
  // 編集モードと完全同一の文言「添付ファイルを削除しました」を使用する。
  const handlePendingFileRemoved = () => {
    showToast('success', ATTACHMENT_DELETE_SUCCESS);
  };

  return (
    <div data-testid="attachment-area">
      {/* ファイル選択 UI（canModify=true のときのみ表示）。
          保留ファイルの一覧・プレビューボタン・削除ボタンは
          AttachmentUploader 内部で管理する（ATT-FE-073/075/077, issue #129）。
          issue #143: 保留完了・削除完了時のトーストは onPendingFileAdded_Success / onPendingFileRemoved 経由で発火する。 */}
      {canModify && (
        <AttachmentUploader
          reportId={reportId}
          itemId={null}
          mode="add"
          onUploadSuccess={() => {
            // 追加モードでは即時アップロードしないため呼ばれないが、型互換のために空実装。
          }}
          onPendingFilesChange={onPendingFilesChange}
          onPendingFileAdded_Success={handlePendingFileAddedSuccess}
          onPendingFileRemoved={handlePendingFileRemoved}
        />
      )}
      {/* add モード用トースト（issue #143: 編集モードと同一文言で発火する）。 */}
      <AppToast
        open={toast.open}
        severity={toast.severity}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
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
  addModeResetKey,
}: AttachmentAreaProps) {
  if (mode === 'add') {
    // 追加モード（明示的に mode="add" が渡された場合のみ）: itemId=null でも表示し、ローカル保持方式を使う。
    // addModeResetKey が変化するたびに AttachmentAreaAddMode を再マウントして
    // AttachmentUploader 内部の pendingFiles state をクリアする（issue #132 codex blocker）。
    return (
      <AttachmentAreaAddMode
        key={addModeResetKey}
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
