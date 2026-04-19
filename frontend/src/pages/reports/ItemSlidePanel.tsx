// 明細スライドパネルコンポーネント。
// 明細の追加・編集・閲覧をスライドパネルで提供する。
// SCR-RPT-004 §6 に対応する。
// ATT-FE-057〜071: 並行操作整合性・破棄確認ダイアログ（issue #108）。

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import type { PaperProps } from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import type { ReportStatus, ExpenseItemWithAttachments } from '../../api/types';
import ItemForm from './ItemForm';
import type { ItemFormValues } from './ItemForm';
import AttachmentArea from './AttachmentArea';
import AppToast from '../../components/ui/AppToast';

export type PanelMode = 'add' | 'edit' | 'view';

export interface ItemSlidePanelProps {
  /** パネルの開閉状態 */
  open: boolean;
  /** パネルモード */
  mode: PanelMode;
  /** レポート ID */
  reportId: string;
  /** 編集/閲覧時の明細データ（追加モードでは null） */
  item: ExpenseItemWithAttachments | null;
  /** レポートステータス */
  reportStatus: ReportStatus;
  /** 所有者フラグ */
  isOwner: boolean;
  /** パネルを閉じるコールバック */
  onClose: () => void;
  /** 明細保存成功時のコールバック */
  onSaveSuccess: () => void;
  /** 「保存して続けて追加」成功時のコールバック */
  onSaveAndContinue: () => void;
  /** カテゴリ選択肢（未指定の場合は空配列） */
  categories?: Array<{ value: string; label: string }>;
  /** API エラーメッセージ */
  apiError?: string | null;
  /** 送信中フラグ（フォーム保存 API 呼び出し中） */
  isPending?: boolean;
  /** アップロード中フラグ（外部注入用: テスト・上位コンポーネントから渡す場合） */
  isUploading?: boolean;
  /** 削除中フラグ（外部注入用: テスト・上位コンポーネントから渡す場合） */
  isDeleting?: boolean;
  /** フォーム送信コールバック */
  onItemSubmit?: (data: ItemFormValues) => void;
  /** 「保存して続けて追加」フォームコールバック */
  onItemSaveAndContinue?: (data: ItemFormValues) => void;
}

/**
 * ItemSlidePanel は明細追加・編集・閲覧のスライドパネルコンポーネント。
 * open=true のとき MUI Drawer が画面右側からスライドインして表示される。
 * mode に応じてフォームの入力可否を制御する。
 * 閲覧モード（mode='view'）では添付操作（アップロード/削除）も不可とする（設計書 §6）。
 *
 * 並行操作整合性（issue #108 課題 1）:
 * - アップロード中・削除中は保存ボタンを disabled にする（§7-1 / §7-3）
 * - 閉じる・キャンセル・フィールド編集は常時有効
 *
 * 破棄確認ダイアログ（issue #108 課題 2）:
 * - フィールドが dirty の場合、× / キャンセル / 外クリックで MUI Dialog を表示
 * - 「破棄」→ パネル閉じ・フォームリセット。「キャンセル」→ パネル保持・内容保持
 * - dirty 時のみ beforeunload イベントリスナを登録してブラウザ標準ダイアログを表示
 */
export default function ItemSlidePanel({
  open,
  mode,
  reportId,
  item,
  isOwner,
  reportStatus,
  onClose,
  onSaveSuccess,
  onSaveAndContinue: onSaveAndContinueProp,
  categories = [],
  apiError = null,
  isPending = false,
  isUploading: isUploadingProp = false,
  isDeleting: isDeletingProp = false,
  onItemSubmit,
  onItemSaveAndContinue,
}: ItemSlidePanelProps) {
  // パネルモードに応じたタイトルを返す。
  const title = mode === 'add' ? '明細追加' : mode === 'edit' ? '明細編集' : '明細詳細';

  // AttachmentArea から通知されるアップロード中・削除中の内部 state。
  // 外部注入 prop（isUploadingProp / isDeletingProp）との OR 合成で保存ボタンの disabled を制御する。
  const [internalIsUploading, setInternalIsUploading] = useState(false);
  const [internalIsDeleting, setInternalIsDeleting] = useState(false);

  // 保存ボタン disabled 判定: isPending || isUploading（外部OR内部） || isDeleting（外部OR内部）
  const isSaveDisabled = isPending || isUploadingProp || internalIsUploading || isDeletingProp || internalIsDeleting;

  // 破棄確認ダイアログの表示状態。
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  // フォームの dirty 状態（React Hook Form の isDirty）。
  const [isFormDirty, setIsFormDirty] = useState(false);

  // フォームリセット関数の ref（「破棄」ボタン押下時に ItemForm の reset() を呼ぶ）。
  const formResetRef = useRef<(() => void) | null>(null);

  // AttachmentArea から公開されるアップロード・削除キャンセル関数の ref。
  // handleCloseAttempt 時（× ボタン / キャンセル / 外クリック）に呼び出し、進行中の mutation を中断する。
  const uploadCancelRef = useRef<(() => void) | null>(null);
  const deleteCancelRef = useRef<(() => void) | null>(null);

  // 中断トースト状態（アップロード/削除の中断通知をパネルレベルで表示する）。
  // AttachmentAreaContent がアンマウント後でも ItemSlidePanel は常にマウント済みのため確実に表示できる（issue #108 §7-2）。
  const [abortToast, setAbortToast] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: '' });

  // アップロード中断時のコールバック（AttachmentArea から呼ばれる）。
  // 明細切替時（key={itemId} による AttachmentAreaContent 再マウント）でも ItemSlidePanel のスコープでトーストを表示する。
  const handleUploadAborted = useCallback(() => {
    setAbortToast({ open: true, message: 'アップロードを中止しました' });
  }, []);

  // 削除中断時のコールバック（AttachmentArea から呼ばれる）。
  const handleDeleteAborted = useCallback(() => {
    setAbortToast({ open: true, message: '削除を中止しました' });
  }, []);

  // 明細データから ItemFormValues を生成する。
  const defaultValues: ItemFormValues | undefined = item
    ? {
        expenseDate: item.expense_date.slice(0, 10),
        amount: item.amount,
        categoryId: item.category.id,
        description: item.description,
      }
    : undefined;

  // canModify: 所有者かつ draft 状態、かつ閲覧モードでない場合のみ明細編集・添付操作が可能。
  // 閲覧モード（mode='view'）では全操作を禁止する（案 B, 設計書 §5/§6）。
  const canModify = isOwner && reportStatus === 'draft' && mode !== 'view';
  const formMode = canModify ? mode : 'view';

  // フォーム送信ハンドラ。onItemSubmit が指定されていれば委譲、なければ onSaveSuccess を呼ぶ。
  const handleSubmit = (data: ItemFormValues) => {
    if (onItemSubmit) {
      onItemSubmit(data);
    } else {
      onSaveSuccess();
    }
  };

  // 「保存して続けて追加」ハンドラ。
  const handleSaveAndContinue =
    mode === 'add'
      ? (data: ItemFormValues) => {
          if (onItemSaveAndContinue) {
            onItemSaveAndContinue(data);
          } else {
            onSaveAndContinueProp();
          }
        }
      : undefined;

  // 破棄確認ダイアログで「破棄」ボタンを押したとき: 進行中のアップロード/削除を中断して
  // フォームをリセットしてパネルを閉じる。
  // dirty 時は handleCloseAttempt で cancel を省略したため、ここで cancel を実行する（issue #108 FIX 1）。
  const handleDiscard = useCallback(() => {
    // 破棄確定時にアップロード/削除を中断する（Dialog「破棄」→ 実際にパネルを閉じる経路）。
    uploadCancelRef.current?.();
    deleteCancelRef.current?.();
    setIsDiscardDialogOpen(false);
    formResetRef.current?.();
    setIsFormDirty(false);
    onClose();
  }, [onClose]);

  // 破棄確認ダイアログで「キャンセル」ボタンを押したとき: ダイアログのみ閉じてパネルは保持。
  const handleDiscardCancel = useCallback(() => {
    setIsDiscardDialogOpen(false);
  }, []);

  // 閉じる操作の共通ハンドラ。dirty の場合は破棄確認ダイアログを表示、非 dirty は即閉じ。
  // アップロード中・削除中の mutation キャンセルは「実際にパネルを閉じる経路」のみで行う。
  // dirty 判定前に cancel() を呼んではならない。ユーザーが Dialog で「キャンセル」を選んで
  // 編集を続行する場合にアップロード/削除が中断されてしまうことを防ぐ（issue #108 FIX 1）。
  const handleCloseAttempt = useCallback(() => {
    if (isFormDirty) {
      // dirty 時は cancel せずダイアログを表示する。アップロード/削除は継続させる。
      setIsDiscardDialogOpen(true);
    } else {
      // 非 dirty: 進行中のアップロード・削除を中断してからパネルを閉じる。
      uploadCancelRef.current?.();
      deleteCancelRef.current?.();
      onClose();
    }
  }, [isFormDirty, onClose]);

  // dirty 時のみ beforeunload イベントリスナを登録して F5 / タブ閉じ / ブラウザ閉じを抑止する。
  // カスタム文言は現代ブラウザで不可のため event.preventDefault() のみ呼ぶ（設計書 §6）。
  useEffect(() => {
    if (!isFormDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isFormDirty]);

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={handleCloseAttempt}
        PaperProps={{
          'data-testid': 'item-slide-panel',
          sx: { width: { xs: '100%', sm: 480 } },
        } as PaperProps}
      >
        {/* ヘッダー: タイトル左・閉じるボタン右の flex レイアウト */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          <IconButton aria-label="閉じる" onClick={handleCloseAttempt} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <ItemForm
          mode={formMode}
          onSubmit={handleSubmit}
          onSaveAndContinue={handleSaveAndContinue}
          onCancel={handleCloseAttempt}
          categories={categories}
          apiError={apiError}
          isPending={isPending}
          isSaveDisabled={isSaveDisabled}
          defaultValues={defaultValues}
          onDirtyChange={setIsFormDirty}
          resetRef={formResetRef}
        />
        {/* 添付ファイル管理領域。追加モードで明細未保存（item=null）の場合は非表示になる。
            uploadCancelRef / deleteCancelRef でアップロード・削除キャンセル関数を受け取る（§7-1）。
            onUploadAborted / onDeleteAborted でパネルレベルの中断トーストを表示する（§7-2）。 */}
        <AttachmentArea
          reportId={reportId}
          itemId={item?.id ?? null}
          canModify={canModify}
          onUploadingChange={setInternalIsUploading}
          onDeletingChange={setInternalIsDeleting}
          uploadCancelRef={uploadCancelRef}
          deleteCancelRef={deleteCancelRef}
          onUploadAborted={handleUploadAborted}
          onDeleteAborted={handleDeleteAborted}
        />
      </Drawer>

      {/* 破棄確認ダイアログ（設計書 §6「編集中の破棄確認ダイアログ」仕様に準拠）。
          タイトル・本文・ボタン文言・スタイルは設計書と完全一致させる。
          条件レンダリングで DOM から完全に除去することでアニメーション残留を防ぐ。 */}
      {isDiscardDialogOpen && (
        <Dialog
          open={true}
          onClose={handleDiscardCancel}
          aria-labelledby="discard-dialog-title"
          aria-describedby="discard-dialog-description"
        >
          <DialogTitle id="discard-dialog-title">変更を破棄しますか？</DialogTitle>
          <DialogContent>
            <DialogContentText id="discard-dialog-description">
              編集内容は保存されていません。破棄するとこれまでの変更が失われます。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDiscardCancel}>キャンセル</Button>
            <Button onClick={handleDiscard} color="error">
              破棄
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {/* 中断トースト（アップロード/削除の中断通知）。
          AttachmentAreaContent がアンマウント後でも ItemSlidePanel スコープで確実に表示できる（issue #108 §7-2）。 */}
      <AppToast
        open={abortToast.open}
        severity="error"
        message={abortToast.message}
        onClose={() => setAbortToast((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}
