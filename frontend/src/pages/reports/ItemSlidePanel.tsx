// 明細スライドパネルコンポーネント。
// 明細の追加・編集・閲覧をスライドパネルで提供する。
// SCR-RPT-004 §6 に対応する。
// ATT-FE-057〜071: 並行操作整合性・破棄確認ダイアログ（issue #108）。
// ATT-FE-079〜083: 追加モードの順次アップロード制御（issue #115）。
// issue #132: 保存成功後の dirty state リセット漏れ修正（beforeunload リスナ残存バグ）。
// issue #132 codex blocker: 保存成功後に AttachmentAreaAddMode を再マウントして内部 pendingFiles をクリアする。

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { api } from '../../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateItem } from '../../hooks/useItems';

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
  /**
   * Drawer のスライドアウトアニメーション完了後のコールバック（issue #130）。
   * MUI Drawer の SlideProps.onExited に配線される。
   * 親コンポーネントはこのコールバックで selectedItem / apiError 等をリセットする。
   */
  onTransitionExited?: () => void;
  /** カテゴリ選択肢（未指定の場合は空配列） */
  categories?: Array<{ value: string; label: string }>;
  /** API エラーメッセージ */
  apiError?: string | null;
  /** 送信中フラグ（フォーム保存 API 呼び出し中） */
  isPending?: boolean;
  /**
   * レポートの対象期間開始日（YYYY-MM-DD 形式）。
   * ItemForm の期間外警告 ConfirmDialog（ITM-007）に渡す。
   */
  reportPeriodStart?: string;
  /**
   * レポートの対象期間終了日（YYYY-MM-DD 形式）。
   * ItemForm の期間外警告 ConfirmDialog（ITM-007）に渡す。
   */
  reportPeriodEnd?: string;
  /** アップロード中フラグ（外部注入用: テスト・上位コンポーネントから渡す場合） */
  isUploading?: boolean;
  /** 削除中フラグ（外部注入用: テスト・上位コンポーネントから渡す場合） */
  isDeleting?: boolean;
  /**
   * 順次アップロード中フラグ（外部注入用: テスト用）。
   * issue #115 実装: 追加モードで保存時の順次アップロード中は true になる。
   */
  isSequentialUploading?: boolean;
  /**
   * 順次アップロード進捗（外部注入用: テスト用）。
   * issue #115 実装: 保存ボタンに「アップロード中... (N/M 件完了)」を表示するために使用する。
   */
  sequentialUploadProgress?: { completed: number; total: number };
  /** フォーム送信コールバック */
  onItemSubmit?: (data: ItemFormValues) => void;
  /** 「保存して続けて追加」フォームコールバック */
  onItemSaveAndContinue?: (data: ItemFormValues) => void;
}

/** 添付ファイルアップロード API のレスポンス型。 */
interface AttachmentApiResponse {
  data: {
    id: string;
    item_id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    created_at: string;
  };
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
 *
 * 追加モードの順次アップロード（issue #115）:
 * - 追加モードでは保留中のファイルをローカル state（pendingFiles）で管理する
 * - 「保存する」押下時: POST items → itemId 取得 → 各ファイルを順次 POST attachments
 * - 順次アップロード中は保存ボタン disabled + スピナー + 「アップロード中... (N/M 件完了)」
 * - 順次アップロード中のフォームフィールドは readonly（整合性崩れ防止）
 * - AbortController で中断制御（パネルクローズ時）
 *
 * 保存成功後の dirty state リセット（issue #132）:
 * - 追加モード: handleAddModeSubmit 内で afterSubmit 前に resetDirtyState() を呼ぶ
 * - 編集モード: open=false になったとき（useEffect）に resetDirtyState() を呼ぶ
 * - 保存して続けて追加: handleAddModeSubmit の afterSubmit 前にリセット済み
 * - これにより保存成功後は isDirty=false → beforeunload リスナが解除され F5 での誤警告がなくなる
 *
 * AttachmentAreaAddMode の内部 pendingFiles クリア（issue #132 codex blocker）:
 * - resetDirtyState() に加え attachmentAddModeResetKey をインクリメントすることで
 *   AttachmentAreaAddMode を再マウントし、AttachmentUploader 内部の pendingFiles をクリアする
 * - AttachmentAreaContent（edit/view モード）には key を当てないため、クエリキャッシュに影響しない
 */
function ItemSlidePanelBody({
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
  isSequentialUploading: isSequentialUploadingProp = false,
  sequentialUploadProgress: sequentialUploadProgressProp,
  onItemSubmit,
  onItemSaveAndContinue,
  reportPeriodStart,
  reportPeriodEnd,
  onTransitionExited,
}: ItemSlidePanelProps) {
  // ItemSlidePanelBody は必ず QueryClientProvider の配下で動作する。
  // main.tsx の QueryClientProvider 配下で使用することを前提とする。
  const queryClient = useQueryClient();

  // 追加モードの明細作成 mutation（blocker 2 対応: api.post() 直呼びをやめて useCreateItem を使う）。
  // isPending が保存ボタン disabled 判定に反映され、二重送信を防ぐ。
  // エラー時は itemApiError state を通じてパネル上部に表示する。
  const createItemMutation = useCreateItem();
  const [itemApiError, setItemApiError] = useState<string | null>(null);

  // パネルモードに応じたタイトルを返す。
  const title = mode === 'add' ? '明細追加' : mode === 'edit' ? '明細編集' : '明細詳細';

  // AttachmentArea から通知されるアップロード中・削除中の内部 state。
  // 外部注入 prop（isUploadingProp / isDeletingProp）との OR 合成で保存ボタンの disabled を制御する。
  const [internalIsUploading, setInternalIsUploading] = useState(false);
  const [internalIsDeleting, setInternalIsDeleting] = useState(false);

  // 追加モードで保存時の順次アップロード中フラグ・進捗（issue #115）。
  // 外部注入 prop（テスト用）との OR 合成で保存ボタン disabled と進捗テキストを制御する。
  const [isSequentialUploading, setIsSequentialUploading] = useState(false);
  const [sequentialUploadProgress, setSequentialUploadProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });

  // 外部注入と内部 state の OR 合成。
  const resolvedIsSequentialUploading = isSequentialUploadingProp || isSequentialUploading;
  const resolvedSequentialUploadProgress = sequentialUploadProgressProp ?? sequentialUploadProgress;

  // 保存ボタン disabled 判定:
  // isPending || createItemMutation.isPending || isUploading（外部OR内部） || isDeleting（外部OR内部） || isSequentialUploading
  // createItemMutation.isPending: add モードの明細作成 POST 中は disabled（blocker 2 対応）。
  const isSaveDisabled =
    isPending ||
    createItemMutation.isPending ||
    isUploadingProp ||
    internalIsUploading ||
    isDeletingProp ||
    internalIsDeleting ||
    resolvedIsSequentialUploading;

  // 順次アップロード中の進捗テキスト（保存ボタンのラベルに表示する）。
  // 設計書 §6「順次アップロード中の UI 表示」L332: ボタンラベルを「アップロード中... (N/M 件完了)」に切り替える。
  const sequentialProgressLabel = resolvedIsSequentialUploading
    ? `アップロード中... (${resolvedSequentialUploadProgress.completed}/${resolvedSequentialUploadProgress.total} 件完了)`
    : '';

  // 破棄確認ダイアログの表示状態。
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  // フォームの dirty 状態（React Hook Form の isDirty）。
  const [isFormDirty, setIsFormDirty] = useState(false);

  // 追加モード: 保留中のファイル一覧（ローカル state で管理、issue #115）。
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // AttachmentAreaAddMode 再マウントキー（issue #132 codex blocker）。
  // resetDirtyState() でインクリメントし、AttachmentAreaAddMode を再マウントすることで
  // AttachmentUploader 内部の pendingFiles state をクリアする。
  // edit/view モードの AttachmentAreaContent には影響しない。
  const [attachmentAddModeResetKey, setAttachmentAddModeResetKey] = useState(0);

  // dirty 判定:
  // - 追加モード: isFormDirty || pendingFiles.length > 0
  // - 編集モード: isFormDirty のみ（添付は即時保存方式のため除外）
  const isDirty = mode === 'add' ? isFormDirty || pendingFiles.length > 0 : isFormDirty;

  // フォームリセット関数の ref（「破棄」ボタン押下時に ItemForm の reset() を呼ぶ）。
  const formResetRef = useRef<(() => void) | null>(null);

  // AttachmentArea から公開されるアップロード・削除キャンセル関数の ref。
  // handleCloseAttempt 時（× ボタン / キャンセル / 外クリック）に呼び出し、進行中の mutation を中断する。
  const uploadCancelRef = useRef<(() => void) | null>(null);
  const deleteCancelRef = useRef<(() => void) | null>(null);

  // 順次アップロードの AbortController（パネルクローズ時に中断するため）。
  const sequentialAbortControllerRef = useRef<AbortController | null>(null);

  // 中断トースト状態（アップロード/削除の中断通知をパネルレベルで表示する）。
  // AttachmentAreaContent がアンマウント後でも ItemSlidePanel は常にマウント済みのため確実に表示できる（issue #108 §7-2）。
  const [abortToast, setAbortToast] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: '' });

  // API エラートースト状態（順次アップロード部分失敗時の警告など）。
  const [apiToast, setApiToast] = useState<{
    open: boolean;
    severity: 'success' | 'error' | 'warning';
    message: string;
  }>({ open: false, severity: 'success', message: '' });

  // 部分失敗時の後続処理（onSaveSuccess + invalidateQueries）をトーストレンダリング後に実行するための ref。
  // handleAddModeSubmit で setApiToast + この ref にセットし、useEffect でトーストレンダリング後に呼び出す。
  // これにより ATT-FE-080 の順序保証（警告トースト表示 → onSaveSuccess → invalidate）を実現する。
  const pendingPostToastActionRef = useRef<(() => void) | null>(null);

  // apiToast が open になったとき（レンダリング後）に pendingPostToastActionRef の処理を実行する。
  // ATT-FE-080: 部分失敗時の「警告トースト表示 → onSaveSuccess → invalidate」順序を保証する。
  // useEffect は React のレンダリング後に呼ばれるため、toast が DOM に表示された後に後続処理が走る。
  useEffect(() => {
    if (apiToast.open && pendingPostToastActionRef.current) {
      const action = pendingPostToastActionRef.current;
      pendingPostToastActionRef.current = null;
      action();
    }
  }, [apiToast]);

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

  // 順次アップロード中のフォームフィールド readonly 制御（issue #115 §6「順次アップロード中の UI 表示」）。
  // 追加モードで順次アップロード中は全フィールドを readonly にする。
  const isFormReadOnly = resolvedIsSequentialUploading;

  // 追加モード: AttachmentAreaAddMode の保留ファイル一覧が変化したときのコールバック。
  // AttachmentArea 内部で管理される pendingFiles の最新リストをここで受け取り、
  // dirty 判定・順次アップロード処理で使用する。
  const handlePendingFilesChange = useCallback((files: File[]) => {
    setPendingFiles(files);
  }, []);

  /**
   * 保存成功後の dirty state リセット（issue #132）。
   * 追加モード・編集モードいずれの保存成功経路でも呼び出し、
   * isFormDirty / pendingFiles / formResetRef をクリアすることで
   * beforeunload リスナが解除された状態でパネルが閉じられる。
   * 破棄経路（handleDiscard）とは独立しており、そちらの挙動は変えない。
   *
   * codex blocker 対応: attachmentAddModeResetKey をインクリメントすることで
   * AttachmentAreaAddMode を再マウントし、AttachmentUploader 内部の
   * pendingFiles state（UI の保留ファイル行）もクリアする。
   */
  const resetDirtyState = useCallback(() => {
    setIsFormDirty(false);
    setPendingFiles([]);
    formResetRef.current?.();
    // AttachmentAreaAddMode を再マウントして内部 pendingFiles をクリアする（issue #132 codex blocker）。
    setAttachmentAddModeResetKey((prev) => prev + 1);
  }, []);

  /**
   * 追加モードの保存処理（順次アップロード）。
   * blocker 1 対応: afterSubmit 引数でコールバックを切り替え、「保存する」と「保存して続けて追加」の
   *   両経路からこの関数を共通で呼び出す。
   * blocker 2 対応: 明細作成に useCreateItem を使い、isPending が保存ボタン disabled に効く形にする。
   *   エラー時は itemApiError state を通じてパネル上部に表示する。
   *
   * 処理フロー:
   * 1. POST items（useCreateItem.mutateAsync）で明細作成 → itemId 取得
   * 2. 各保留ファイルを順次 POST attachments（AbortController で中断可能）
   * 3. 全成功: 成功トースト → afterSubmit() 呼び出し（パネルクローズ or 続けて追加準備）
   * 4. 部分失敗: 警告トースト → afterSubmit() 呼び出し
   * 5. 中断: 「アップロードを中止しました」トースト
   *
   * @param formData フォームの入力値
   * @param afterSubmit 保存完了後の後続処理（パネルクローズ / フォームリセット 等）
   */
  const handleAddModeSubmit = useCallback(async (formData: ItemFormValues, afterSubmit: () => void) => {
    // 明細作成前にエラーをリセットする。
    setItemApiError(null);

    // 新しい AbortController を生成する（前のものが残っていれば中断）。
    // try の外で生成し、finally で必ず ref をリセットすることでリソース解放を一貫させる（FIX 5）。
    if (sequentialAbortControllerRef.current) {
      sequentialAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    sequentialAbortControllerRef.current = abortController;

    const { signal } = abortController;

    try {
      // Step 1: 明細作成（useCreateItem を使う: blocker 2 対応）。
      // mutateAsync は reject 時に throw するため catch ブロックで itemApiError を設定できる。
      // useCreateItem の isPending が isSaveDisabled に反映され、二重送信を防ぐ。
      // ※ useCreateItem は内部で api.post() を signal なしで呼ぶため、
      //   明細作成リクエスト自体は AbortController で中断できない。
      //   中断可能なのは添付アップロード（Step 2）のみ。
      let newItemId: string;
      try {
        const createdItem = await createItemMutation.mutateAsync({
          reportId,
          expense_date: formData.expenseDate,
          amount: formData.amount,
          category_id: formData.categoryId,
          description: formData.description,
        });
        newItemId = createdItem.id;
      } catch (createErr) {
        // 明細作成失敗: itemApiError にセットしてパネル上部に表示する（設計書「パネル上部エラー表示」準拠）。
        // client.ts 層でマッピング済みの err.message をそのまま使う。
        const message =
          createErr instanceof Error
            ? createErr.message
            : '明細の保存に失敗しました';
        setItemApiError(message);
        return;
      }

      // 保留ファイルが 0 件の場合は即 afterSubmit 呼び出し。
      if (pendingFiles.length === 0) {
        setApiToast({ open: true, severity: 'success', message: '明細を追加しました' });
        void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
        // 保存成功時に dirty state をリセットして beforeunload リスナを解除する（issue #132）。
        resetDirtyState();
        afterSubmit();
        return;
      }

      // Step 2: 各保留ファイルを順次アップロード。
      const totalFiles = pendingFiles.length;
      setIsSequentialUploading(true);
      setSequentialUploadProgress({ completed: 0, total: totalFiles });

      let failedCount = 0;

      for (let i = 0; i < totalFiles; i++) {
        // 中断チェック。
        if (signal.aborted) {
          setAbortToast({ open: true, message: 'アップロードを中止しました' });
          setIsSequentialUploading(false);
          return;
        }

        const file = pendingFiles[i];
        // for ループの境界チェック（i < totalFiles）を通過しているため file は常に定義済みだが、
        // TypeScript の array index access で undefined になる可能性があるため型ガードを追加する。
        if (!file) continue;
        const formDataForUpload = new FormData();
        formDataForUpload.append('file', file);

        try {
          await api.post<AttachmentApiResponse>(
            `/api/reports/${reportId}/items/${newItemId}/attachments`,
            formDataForUpload,
            signal,
          );
          // 1 件完了するごとに進捗を更新する。
          setSequentialUploadProgress({ completed: i + 1, total: totalFiles });
        } catch (err) {
          // AbortError の場合は中断処理を行い、ループを抜ける。
          if (err instanceof Error && err.name === 'AbortError') {
            setAbortToast({ open: true, message: 'アップロードを中止しました' });
            setIsSequentialUploading(false);
            return;
          }
          // その他のエラーは失敗カウントを増やす（ロールバックしない）。
          failedCount++;
        }
      }

      setIsSequentialUploading(false);

      if (failedCount > 0) {
        // 部分失敗: 警告トースト → afterSubmit → 一覧 invalidate の順序（ATT-FE-080）。
        // 設計書 §6 「3b 部分失敗」: 警告トーストを先に表示してから afterSubmit と invalidate を呼ぶ。
        // pendingPostToastActionRef に後続処理を登録し、useEffect（レンダリング後）で実行することで
        // トーストが DOM に表示された後に afterSubmit → invalidate の順序を保証する（ATT-FE-080）。
        // 保存成功時（部分失敗を含む）に dirty state をリセットして beforeunload リスナを解除する（issue #132）。
        pendingPostToastActionRef.current = () => {
          resetDirtyState();
          afterSubmit();
          void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
        };
        setApiToast({
          open: true,
          severity: 'warning',
          message: `${failedCount} 件の添付ファイルがアップロードに失敗しました。再試行してください`,
        });
      } else {
        // 全成功: 成功トースト + afterSubmit + 一覧 invalidate。
        setApiToast({ open: true, severity: 'success', message: '明細を追加しました' });
        void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
        // 保存成功時に dirty state をリセットして beforeunload リスナを解除する（issue #132）。
        resetDirtyState();
        afterSubmit();
      }
    } finally {
      // 成功・中断・その他エラーのいずれの経路でも ref をリセットしてリソースを解放する（FIX 5）。
      sequentialAbortControllerRef.current = null;
    }
  }, [reportId, pendingFiles, queryClient, createItemMutation, resetDirtyState]);

  // フォーム送信ハンドラ。
  const handleSubmit = (data: ItemFormValues) => {
    if (mode === 'add') {
      // 追加モード: 順次アップロード付きの保存処理を実行する。
      // dirty state のリセットは handleAddModeSubmit 内部で afterSubmit 前に実行される（issue #132）。
      void handleAddModeSubmit(data, onSaveSuccess);
    } else if (onItemSubmit) {
      // 編集モード: 親（ReportDetailPage）の onItemSubmit に委譲する。
      // dirty state のリセットは open が false になったときの useEffect で行う（issue #132）。
      onItemSubmit(data);
    } else {
      onSaveSuccess();
    }
  };

  // 「保存して続けて追加」ハンドラ（blocker 1 対応）。
  // add モードでは handleAddModeSubmit を通すことで pendingFiles の順次アップロードが確実に実行される。
  // afterSubmit: フォームリセット + 続けて追加準備（onSaveAndContinueProp）
  // edit モードでは従来どおり onItemSaveAndContinue / onSaveAndContinueProp に委譲する。
  const handleSaveAndContinue =
    mode === 'add'
      ? (data: ItemFormValues) => {
          void handleAddModeSubmit(data, () => {
            // 「保存して続けて追加」の後続処理: フォームリセット + 次の明細入力準備。
            // onItemSaveAndContinue が指定されている場合はそちらを呼ぶ（テスト用 override）。
            if (onItemSaveAndContinue) {
              onItemSaveAndContinue(data);
            } else {
              onSaveAndContinueProp();
            }
          });
        }
      : undefined;

  // 順次アップロードを中断するヘルパー。
  const abortSequentialUpload = useCallback(() => {
    if (sequentialAbortControllerRef.current) {
      sequentialAbortControllerRef.current.abort();
      sequentialAbortControllerRef.current = null;
      setIsSequentialUploading(false);
    }
  }, []);

  // 破棄確認ダイアログで「破棄」ボタンを押したとき: 進行中のアップロード/削除を中断して
  // フォームをリセットしてパネルを閉じる。
  // dirty 時は handleCloseAttempt で cancel を省略したため、ここで cancel を実行する（issue #108 FIX 1）。
  const handleDiscard = useCallback(() => {
    // 破棄確定時にアップロード/削除・順次アップロードを中断する（Dialog「破棄」→ 実際にパネルを閉じる経路）。
    uploadCancelRef.current?.();
    deleteCancelRef.current?.();
    abortSequentialUpload();
    setIsDiscardDialogOpen(false);
    formResetRef.current?.();
    setIsFormDirty(false);
    setPendingFiles([]);
    // AttachmentAreaAddMode を再マウントして内部 pendingFiles をクリアする（issue #132 codex blocker）。
    // 破棄経路でも UI 上の保留ファイル行が消えることを保証する。
    setAttachmentAddModeResetKey((prev) => prev + 1);
    onClose();
  }, [onClose, abortSequentialUpload]);

  // 破棄確認ダイアログで「キャンセル」ボタンを押したとき: ダイアログのみ閉じてパネルは保持。
  const handleDiscardCancel = useCallback(() => {
    setIsDiscardDialogOpen(false);
  }, []);

  // 閉じる操作の共通ハンドラ。
  // 順次アップロード中: dirty=false 扱い（保存処理に入っているため、破棄確認ダイアログは表示しない）。
  //   → AbortController で中断し、「アップロードを中止しました」トーストを表示。
  // dirty（フォーム変更 or 保留添付 1 件以上）: 破棄確認ダイアログを表示。
  // 非 dirty: 即パネルクローズ。
  const handleCloseAttempt = useCallback(() => {
    if (resolvedIsSequentialUploading) {
      // 順次アップロード中は即中断してパネルを閉じる（破棄確認ダイアログは表示しない）。
      abortSequentialUpload();
      setAbortToast({ open: true, message: 'アップロードを中止しました' });
      onClose();
      return;
    }
    if (isDirty) {
      // dirty 時は cancel せずダイアログを表示する。アップロード/削除は継続させる。
      setIsDiscardDialogOpen(true);
    } else {
      // 非 dirty: 進行中のアップロード・削除を中断してからパネルを閉じる。
      uploadCancelRef.current?.();
      deleteCancelRef.current?.();
      onClose();
    }
  }, [resolvedIsSequentialUploading, isDirty, onClose, abortSequentialUpload]);

  // パネルが閉じたとき（open: true → false）に dirty state をリセットする（issue #132）。
  // MUI Drawer は open=false でもコンテンツをアンマウントしないため、
  // state が残存して beforeunload リスナが継続登録される問題を解消する。
  // 編集モード経路: onItemSubmit → 親の mutation.onSuccess → open=false（setPanelState）→
  //   この useEffect → resetDirtyState → isDirty=false → beforeunload リスナ解除
  // 追加モード経路: handleAddModeSubmit 内で resetDirtyState を呼んでいるが、
  //   こちらの useEffect も idempotent（二重呼び出し ok）。
  // 破棄経路: handleDiscard で既にリセット済みだが、こちらも idempotent。
  useEffect(() => {
    if (!open) {
      resetDirtyState();
    }
  }, [open, resetDirtyState]);

  // dirty 時のみ beforeunload イベントリスナを登録して F5 / タブ閉じ / ブラウザ閉じを抑止する。
  // カスタム文言は現代ブラウザで不可のため event.preventDefault() のみ呼ぶ（設計書 §6）。
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

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
        SlideProps={onTransitionExited ? { onExited: onTransitionExited } : undefined}
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
          apiError={itemApiError ?? apiError}
          isPending={isPending}
          isSaveDisabled={isSaveDisabled}
          isSaveButtonLoading={resolvedIsSequentialUploading || isPending || createItemMutation.isPending}
          saveButtonLabel={sequentialProgressLabel || undefined}
          defaultValues={defaultValues}
          onDirtyChange={setIsFormDirty}
          resetRef={formResetRef}
          readOnly={isFormReadOnly}
          reportPeriodStart={reportPeriodStart}
          reportPeriodEnd={reportPeriodEnd}
        />
        {/* 添付ファイル管理領域。
            追加モード（mode='add'）: itemId=null でも表示し、ローカル保持方式を使う（issue #115）。
            uploadCancelRef / deleteCancelRef でアップロード・削除キャンセル関数を受け取る（§7-1）。
            onUploadAborted / onDeleteAborted でパネルレベルの中断トーストを表示する（§7-2）。
            addModeResetKey: 保存成功・破棄時に AttachmentAreaAddMode を再マウントして
              AttachmentUploader 内部の pendingFiles をクリアする（issue #132 codex blocker）。 */}
        <AttachmentArea
          reportId={reportId}
          itemId={item?.id ?? null}
          mode={mode}
          canModify={canModify}
          onUploadingChange={setInternalIsUploading}
          onDeletingChange={setInternalIsDeleting}
          uploadCancelRef={uploadCancelRef}
          deleteCancelRef={deleteCancelRef}
          onUploadAborted={handleUploadAborted}
          onDeleteAborted={handleDeleteAborted}
          onPendingFilesChange={mode === 'add' ? handlePendingFilesChange : undefined}
          addModeResetKey={attachmentAddModeResetKey}
        />
      </Drawer>

      {/* 破棄確認ダイアログ（設計書 §6「編集中の破棄確認ダイアログ」仕様に準拠）。
          ConfirmDialog 共通コンポーネント経由でボタン variant・レイアウトを統一する（issue #136）。
          条件レンダリングで DOM から完全に除去することでアニメーション残留を防ぐ。 */}
      {isDiscardDialogOpen && (
        <ConfirmDialog
          open={true}
          title="変更を破棄しますか？"
          message="編集内容は保存されていません。破棄するとこれまでの変更が失われます。"
          confirmLabel="破棄"
          confirmColor="error"
          cancelLabel="キャンセル"
          onConfirm={handleDiscard}
          onCancel={handleDiscardCancel}
        />
      )}
      {/* 中断トースト（アップロード/削除の中断通知）。
          AttachmentAreaContent がアンマウント後でも ItemSlidePanel スコープで確実に表示できる（issue #108 §7-2）。 */}
      <AppToast
        open={abortToast.open}
        severity="error"
        message={abortToast.message}
        onClose={() => setAbortToast((prev) => ({ ...prev, open: false }))}
      />
      {/* API 結果トースト（順次アップロード部分失敗の警告・成功通知など）。 */}
      <AppToast
        open={apiToast.open}
        severity={apiToast.severity}
        message={apiToast.message}
        onClose={() => setApiToast((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}

/**
 * ItemSlidePanel の公開コンポーネント。
 * main.tsx の QueryClientProvider 配下で使用することを前提とする。
 * テストでは createWrapper() / QueryClientProvider でラップしてから render すること。
 */
export default function ItemSlidePanel(props: ItemSlidePanelProps) {
  return <ItemSlidePanelBody {...props} />;
}
