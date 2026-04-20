// 明細フォームコンポーネント。
// 明細の入力フォーム。React Hook Form + Zod でバリデーションを行う。
// SCR-RPT-004 §6 に対応する。
// ATT-FE-064〜071: dirty 判定・beforeunload 対応（issue #108 課題 2）。
// ITM-FE-099〜106: 期間外警告 ConfirmDialog（issue #127 Phase 4）。

import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@mui/material/Button';
import type { PanelMode } from './ItemSlidePanel';
import FormAlert from '../../components/ui/FormAlert';
import AppTextField from '../../components/ui/AppTextField';
import AppSelect from '../../components/ui/AppSelect';
import SubmitButton from '../../components/ui/SubmitButton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { WARNING_MESSAGES } from '../../lib/warningMessages';

export interface ItemFormValues {
  /** 支出日（YYYY-MM-DD 形式） */
  expenseDate: string;
  /** 金額（円、正の整数） */
  amount: number;
  /** カテゴリ ID */
  categoryId: string;
  /** 摘要 */
  description: string;
}

export interface ItemFormProps {
  /** パネルモード */
  mode: PanelMode;
  /** フォーム送信コールバック */
  onSubmit: (data: ItemFormValues) => void;
  /** 「保存して続けて追加」コールバック（追加モードのみ） */
  onSaveAndContinue?: (data: ItemFormValues) => void;
  /** キャンセルコールバック */
  onCancel: () => void;
  /** カテゴリ一覧（ドロップダウン選択肢） */
  categories: Array<{ value: string; label: string }>;
  /** API エラーメッセージ */
  apiError: string | null;
  /** 送信中フラグ（フォーム保存 API 呼び出し中）。フィールドの disabled 制御に使用する。 */
  isPending: boolean;
  /** 保存ボタン disabled フラグ（isPending || isUploading || isDeleting の OR 合成）。
   * 省略時は isPending と同じ値を使用する。 */
  isSaveDisabled?: boolean;
  /** 保存ボタンのローディング表示フラグ（isPending と独立して制御する場合に使用）。 */
  isSaveButtonLoading?: boolean;
  /** 保存ボタンのラベル（省略時は「保存する」）。順次アップロード中は進捗テキストを渡す。 */
  saveButtonLabel?: string;
  /**
   * フォームフィールドを全体的に readonly にするフラグ（mode='view' とは独立）。
   * 追加モードで順次アップロード中はフォームフィールドを readonly にする（issue #115 §6）。
   */
  readOnly?: boolean;
  /** 編集/閲覧時の初期値 */
  defaultValues?: ItemFormValues;
  /** dirty 状態変化コールバック（パネル側の破棄確認制御に使用） */
  onDirtyChange?: (isDirty: boolean) => void;
  /** フォームリセット関数を外部に渡すための ref（「破棄」操作時に呼ぶ） */
  resetRef?: React.MutableRefObject<(() => void) | null>;
  /**
   * レポートの対象期間開始日（YYYY-MM-DD 形式）。
   * 指定された場合、保存時に expenseDate との比較で期間外警告 ConfirmDialog を表示する（ITM-007）。
   * View モードでは判定をスキップする。
   */
  reportPeriodStart?: string;
  /**
   * レポートの対象期間終了日（YYYY-MM-DD 形式）。
   * 指定された場合、保存時に expenseDate との比較で期間外警告 ConfirmDialog を表示する（ITM-007）。
   * View モードでは判定をスキップする。
   */
  reportPeriodEnd?: string;
}

/**
 * 明細フォームの Zod バリデーションスキーマ。
 * V1: 日付必須、V2: 金額必須、V3: 正の整数、V4: 整数のみ、V5: カテゴリ必須、V6: 摘要必須、V7: 500文字以内
 */
const itemFormSchema = z.object({
  // V1: 日付必須
  expenseDate: z.string().min(1, '日付を入力してください'),
  // V2/V3/V4: 金額必須・正の整数・円単位
  amount: z
    .number({ error: '金額を入力してください' })
    .int('円単位の整数で入力してください')
    .positive('正の金額を入力してください'),
  // V5: カテゴリ必須
  categoryId: z.string().min(1, 'カテゴリを選択してください'),
  // V6/V7: 摘要必須・500文字以内
  description: z
    .string()
    .min(1, '摘要を入力してください')
    .max(500, '摘要は500文字以内で入力してください'),
});

/**
 * ItemForm は明細追加・編集・閲覧フォームコンポーネント。
 * mode='view' のとき全フィールドが readOnly（inputProps.readOnly）になる（案 A）。
 * disabled は送信中（isPending）かつ閲覧モードでない場合のみ適用する。
 * mode='add' のとき「保存して続けて追加」ボタンも表示する。
 * dirty 判定: React Hook Form の isDirty を使い、フィールド変更時に onDirtyChange で通知する（issue #108）。
 * 添付操作（追加・削除）は isDirty に含めない（即時保存方式と整合、issue 114 §7 冒頭）。
 * readOnly=true のとき（追加モードの順次アップロード中）: mode='view' と同様の readOnly 制御を適用（issue #115）。
 */
export default function ItemForm({
  mode,
  onSubmit,
  onSaveAndContinue,
  onCancel,
  categories,
  apiError,
  isPending,
  isSaveDisabled,
  isSaveButtonLoading,
  saveButtonLabel,
  readOnly = false,
  defaultValues,
  onDirtyChange,
  resetRef,
  reportPeriodStart,
  reportPeriodEnd,
}: ItemFormProps) {
  // 保存ボタンの disabled フラグ: isSaveDisabled が指定されていない場合は isPending を使用する。
  const saveDisabled = isSaveDisabled ?? isPending;
  const isView = mode === 'view';
  const isAdd = mode === 'add';
  // readOnly: mode='view' または外部から readOnly=true が渡された場合（順次アップロード中）。
  const isReadOnly = isView || readOnly;

  // 期間外警告 ConfirmDialog の表示状態（ITM-007）。
  // 確認ボタン押下後に呼ぶコールバックを保持する（onSubmit か onSaveAndContinue かを区別するため）。
  const [periodWarningDialogOpen, setPeriodWarningDialogOpen] = useState(false);
  const pendingSubmitCallbackRef = useRef<(() => void) | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: defaultValues ?? {
      expenseDate: '',
      // 未入力時に「金額を入力してください」エラーを出すため NaN を初期値とする。
      amount: NaN,
      categoryId: '',
      description: '',
    },
  });

  // resetRef に reset 関数を登録して、親コンポーネント（ItemSlidePanel）から破棄操作時に呼べるようにする。
  useEffect(() => {
    if (resetRef) {
      resetRef.current = () => {
        reset(
          defaultValues ?? {
            expenseDate: '',
            amount: NaN,
            categoryId: '',
            description: '',
          },
        );
      };
    }
    return () => {
      if (resetRef) {
        resetRef.current = null;
      }
    };
  }, [resetRef, reset, defaultValues]);

  // isDirty が変化したときに親コンポーネントに通知する。
  // useRef で前の値を保持して不要な通知を防ぐ。
  const prevIsDirtyRef = useRef<boolean>(isDirty);
  useEffect(() => {
    if (prevIsDirtyRef.current !== isDirty) {
      prevIsDirtyRef.current = isDirty;
      onDirtyChange?.(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  /**
   * 期間外判定（ITM-007）。
   * expenseDate が reportPeriodStart より前、または reportPeriodEnd より後の場合に true を返す。
   * 境界値（開始日/終了日ちょうど）は期間内扱い（strict less/greater）。
   * View モードでは判定をスキップして常に false を返す。
   *
   * period_start / period_end は YYYY-MM-DD 形式が前提だが、API が RFC3339
   * （例: 2026-04-01T00:00:00Z）で返すケースを考慮して先頭 10 文字を切り出して
   * 正規化する（issue 117 の根本修正が完了するまでの防御コード）。
   * @param expenseDate 支出日（YYYY-MM-DD 形式）
   */
  const isOutsidePeriod = (expenseDate: string): boolean => {
    if (isView) return false;
    if (!reportPeriodStart || !reportPeriodEnd || !expenseDate) return false;
    const normalizedStart = reportPeriodStart.slice(0, 10);
    const normalizedEnd = reportPeriodEnd.slice(0, 10);
    return expenseDate < normalizedStart || expenseDate > normalizedEnd;
  };

  /**
   * 保存処理の共通ロジック。
   * 期間外の場合は ConfirmDialog を表示し、確認後に callback を呼ぶ。
   * 期間内の場合は即座に callback を呼ぶ。
   * @param data バリデーション通過後のフォーム値
   * @param callback 実際の保存処理（onSubmit または onSaveAndContinue）
   */
  const executeSaveWithPeriodCheck = (data: ItemFormValues, callback: (d: ItemFormValues) => void) => {
    if (isOutsidePeriod(data.expenseDate)) {
      // 期間外: ConfirmDialog を表示し、確認後にコールバックを呼ぶ。
      pendingSubmitCallbackRef.current = () => callback(data);
      setPeriodWarningDialogOpen(true);
    } else {
      // 期間内: 即座に保存処理を実行する。
      callback(data);
    }
  };

  // 「保存して続けて追加」ボタン押下時: バリデーション通過後に onSaveAndContinue を呼ぶ。
  const handleSaveAndContinue = handleSubmit((data) => {
    if (onSaveAndContinue) {
      executeSaveWithPeriodCheck(data, onSaveAndContinue);
    }
  });

  // form の onSubmit ハンドラ: バリデーション通過後に期間外チェックを行い、
  // 期間外なら ConfirmDialog を表示、期間内なら即座に onSubmit コールバックを呼ぶ。
  const handleFormSubmit = handleSubmit((data) => {
    executeSaveWithPeriodCheck(data, onSubmit);
  });

  // 期間外警告 ConfirmDialog の確認ボタン押下時: ダイアログを閉じ、保留中の保存処理を実行する。
  const handlePeriodWarningConfirm = () => {
    setPeriodWarningDialogOpen(false);
    if (pendingSubmitCallbackRef.current) {
      const callback = pendingSubmitCallbackRef.current;
      pendingSubmitCallbackRef.current = null;
      callback();
    }
  };

  // 期間外警告 ConfirmDialog のキャンセルボタン押下時: ダイアログを閉じ、フォームに戻る（保存しない）。
  // フォームの入力値は維持する（reset() を呼ばない）。
  const handlePeriodWarningCancel = () => {
    setPeriodWarningDialogOpen(false);
    pendingSubmitCallbackRef.current = null;
  };

  return (
    <form data-testid="item-form" onSubmit={handleFormSubmit} noValidate>
      {/* API エラー表示 */}
      <FormAlert message={apiError} />

      {/* 支出日。閲覧モード（isReadOnly）では inputProps.readOnly で読み取り専用にする（案 A）。
          disabled は送信中（isPending）かつ読み取り専用でない場合のみ適用する。 */}
      <AppTextField
        {...register('expenseDate')}
        label="日付"
        type="date"
        InputLabelProps={{ shrink: true }}
        inputProps={{ readOnly: isReadOnly, 'aria-label': '日付' }}
        disabled={isPending && !isReadOnly}
        errorMessage={errors.expenseDate?.message}
      />

      {/* 金額。読み取り専用モードでは readOnly、送信中は disabled。 */}
      <AppTextField
        {...register('amount', { valueAsNumber: true })}
        label="金額"
        type="number"
        inputProps={{ readOnly: isReadOnly, 'aria-label': '金額' }}
        disabled={isPending && !isReadOnly}
        errorMessage={errors.amount?.message}
      />

      {/* カテゴリ。読み取り専用モードでは AppSelect の readOnly prop でドロップダウンを開かせない（案 A ①）。
          disabled は送信中かつ読み取り専用でない場合のみ適用し、グレーアウトしない。 */}
      <Controller
        name="categoryId"
        control={control}
        render={({ field }) => (
          <AppSelect
            name="categoryId"
            label="カテゴリ"
            options={categories}
            value={field.value}
            onChange={field.onChange}
            errorMessage={errors.categoryId?.message}
            disabled={isPending && !isReadOnly}
            readOnly={isReadOnly}
          />
        )}
      />

      {/* 摘要。読み取り専用モードでは readOnly、送信中は disabled。 */}
      <AppTextField
        {...register('description')}
        label="摘要"
        multiline
        rows={3}
        inputProps={{ readOnly: isReadOnly, 'aria-label': '摘要' }}
        disabled={isPending && !isReadOnly}
        errorMessage={errors.description?.message}
      />

      {/* アクションボタン */}
      {!isView && (
        <>
          {/* 保存ボタン: isPending || isUploading || isDeleting || isSequentialUploading の OR 合成で disabled になる（§7-1 / §7-3 / §6 issue #115）。 */}
          <SubmitButton
            label={saveButtonLabel ?? '保存する'}
            loading={isSaveButtonLoading ?? isPending}
            disabled={saveDisabled}
          />
          {isAdd && onSaveAndContinue && (
            <Button
              type="button"
              variant="outlined"
              onClick={handleSaveAndContinue}
              disabled={saveDisabled}
            >
              保存して続けて追加
            </Button>
          )}
          {/* キャンセルボタン: 常時有効（アップロード中・削除中でも閉じ操作を許可、§7-1）。 */}
          <Button
            type="button"
            variant="text"
            onClick={onCancel}
          >
            キャンセル
          </Button>
        </>
      )}

      {/* 期間外警告 ConfirmDialog（ITM-007）。
          View モードでは表示しない（isView=true のとき periodWarningDialogOpen は常に false）。
          タイトル「入力内容の確認」・確認ボタン「保存する」・キャンセルボタン「キャンセル」。
          確認押下: 保存処理を継続（期間外でも保存は許可）。
          キャンセル押下: ダイアログを閉じてフォームに戻る（入力値は維持）。 */}
      <ConfirmDialog
        open={periodWarningDialogOpen}
        title="入力内容の確認"
        message={WARNING_MESSAGES.ITEM_DATE_OUTSIDE_PERIOD_WARNING}
        confirmLabel="保存する"
        confirmColor="primary"
        cancelLabel="キャンセル"
        onConfirm={handlePeriodWarningConfirm}
        onCancel={handlePeriodWarningCancel}
      />
    </form>
  );
}
