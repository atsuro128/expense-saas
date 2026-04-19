// AttachmentArea コンポーネント。
// 明細スライドパネル内の添付ファイル管理領域。
// AttachmentList と AttachmentUploader を統合する orchestration コンポーネント。
// プレビュー・ダウンロードの window.open 呼び出しは AttachmentList 内の AttachmentItemRow が担当する。
// report-detail.md §AttachmentArea に対応する。
// ATT-FE-060/062/063: AbortController による中断トースト対応（issue #108）。

import { useState, useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import Typography from '@mui/material/Typography';
import AttachmentList from './AttachmentList';
import AttachmentUploader from './AttachmentUploader';
import AppToast from '../../components/ui/AppToast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAttachments } from '../../hooks/useAttachments';
import { useDeleteAttachment } from '../../hooks/useDeleteAttachment';
import type { Attachment } from '../../api/types';

// 添付の即時保存方式をユーザーに案内するテキスト（report-detail.md §7 冒頭の仕様に準拠）。
const ATTACHMENT_PERSISTENCE_NOTICE =
  '※ 添付ファイルは選択した時点で保存されます。フォームをキャンセルしても添付は残ります。';

export interface AttachmentAreaProps {
  /** レポート ID */
  reportId: string;
  /** 明細 ID（明細保存後に設定される。未保存の追加モードでは null） */
  itemId: string | null;
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
}

/**
 * AttachmentAreaContent は itemId が確定した後の実際のコンテンツを描画する内部コンポーネント。
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
  // deleteAttachment.cancel は Hook 内で useCallback なしに毎 render 再生成されるが、
  // ref への登録はマウント時の 1 回で十分（cancel は常に abortControllerRef.current を参照する）。
  // 依存配列に [deleteAttachment.cancel, deleteCancelRef] を明記して React の useEffect hygiene を遵守する
  // （issue #108 FIX 3）。
  useEffect(() => {
    if (deleteCancelRef) {
      deleteCancelRef.current = deleteAttachment.cancel;
    }
    return () => {
      if (deleteCancelRef) {
        deleteCancelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteAttachment.cancel, deleteCancelRef]);

  // AttachmentUploader に渡すアップロードキャンセル ref（内部用フォールバック）。
  // uploadCancelRef が外部から渡されていればそちらを使い、なければ内部 ref を使う。
  const internalUploadCancelRef = useRef<(() => void) | null>(null);
  const attachmentUploaderCancelRef = uploadCancelRef ?? internalUploadCancelRef;

  const attachments: Attachment[] = attachmentsData?.data ?? [];

  // トーストを表示するヘルパー。
  const showToast = (severity: 'success' | 'error', message: string) => {
    setToast({ open: true, severity, message });
  };

  // アップロード成功コールバック。キャッシュの無効化は useUploadAttachment Hook が担当する。
  const handleUploadSuccess = () => {
    showToast('success', 'ファイルをアップロードしました');
  };

  // アップロード中断コールバック。AbortError 発生時に親コンポーネントへ通知する。
  // onUploadAborted が提供されている場合は親（ItemSlidePanel）でトーストを表示する。
  // 提供されていない場合はローカルトーストを表示する（コンポーネント独立使用時のフォールバック）。
  // note: AttachmentAreaContent がアンマウント後に呼ばれる場合（明細切替）でも
  //       onUploadAborted は ItemSlidePanel のクロージャを参照するため確実に動作する（issue #108 §7-2）。
  const handleUploadAborted = () => {
    if (onUploadAborted) {
      onUploadAborted();
    } else {
      showToast('error', 'アップロードを中止しました');
    }
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
    // 削除中状態を親に通知する（保存ボタン disabled 制御）。
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
          // AbortError（削除中断）を識別して専用コールバック or ローカルトーストで通知する。
          if (err instanceof Error && err.name === 'AbortError') {
            if (onDeleteAborted) {
              onDeleteAborted();
            } else {
              showToast('error', '削除を中止しました');
            }
            return;
          }
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
      {/* 添付ファイル一覧。per-item hook orchestration は AttachmentList 内の AttachmentItemRow が担当する。 */}
      <AttachmentList
        attachments={attachments}
        reportId={reportId}
        itemId={itemId}
        canDelete={canModify}
        deletingId={deletingId}
        onDelete={handleDeleteRequest}
        onError={(message) => showToast('error', message)}
      />
      {/* 永続化タイミング案内文（report-detail.md §7 冒頭の仕様に準拠）。
          添付の追加・削除はフォームの保存ボタンと独立した即時保存方式であることを常時表示する。 */}
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mt: 1 }}
        data-testid="attachment-persistence-notice"
      >
        {ATTACHMENT_PERSISTENCE_NOTICE}
      </Typography>
      {canModify && (
        <AttachmentUploader
          reportId={reportId}
          itemId={itemId}
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
      {/* 添付削除の確認ダイアログ（screens.md §4.6 準拠）。
          条件レンダリングで DOM から完全に除去し aria-modal 残留によるアクセシビリティ問題を防ぐ。 */}
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
 * AttachmentArea は明細スライドパネル内の添付ファイル管理領域を提供する。
 * itemId が null の場合（追加モードで未保存）は非表示にする。
 * key={itemId} で itemId が変わるたびに AttachmentAreaContent を再マウントして
 * 進行中の mutation が中断される（issue #108 課題 1、§7-2）。
 */
export default function AttachmentArea({
  reportId,
  itemId,
  canModify,
  onUploadingChange,
  onDeletingChange,
  uploadCancelRef,
  deleteCancelRef,
  onUploadAborted,
  onDeleteAborted,
}: AttachmentAreaProps) {
  // itemId が null の場合は何も描画しない（追加モード・未保存）。
  if (itemId === null) {
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
