// 明細フォームコンポーネント。
// 明細の入力フォーム。React Hook Form + Zod でバリデーションを行う。
// SCR-RPT-004 §6 に対応する。

import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@mui/material/Button';
import type { PanelMode } from './ItemSlidePanel';
import FormAlert from '../../components/ui/FormAlert';
import AppTextField from '../../components/ui/AppTextField';
import AppSelect from '../../components/ui/AppSelect';
import SubmitButton from '../../components/ui/SubmitButton';

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
  /** 送信中フラグ */
  isPending: boolean;
  /** 編集/閲覧時の初期値 */
  defaultValues?: ItemFormValues;
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
 */
export default function ItemForm({
  mode,
  onSubmit,
  onSaveAndContinue,
  onCancel,
  categories,
  apiError,
  isPending,
  defaultValues,
}: ItemFormProps) {
  const isView = mode === 'view';
  const isAdd = mode === 'add';

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
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

  // 「保存して続けて追加」ボタン押下時: バリデーション通過後に onSaveAndContinue を呼ぶ。
  const handleSaveAndContinue = handleSubmit((data) => {
    if (onSaveAndContinue) {
      onSaveAndContinue(data);
    }
  });

  return (
    <form data-testid="item-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* API エラー表示 */}
      <FormAlert message={apiError} />

      {/* 支出日。閲覧モード（isView）では inputProps.readOnly で読み取り専用にする（案 A）。
          disabled は送信中（isPending）かつ閲覧モードでない場合のみ適用する。 */}
      <AppTextField
        {...register('expenseDate')}
        label="日付"
        type="date"
        InputLabelProps={{ shrink: true }}
        inputProps={{ readOnly: isView, 'aria-label': '日付' }}
        disabled={isPending && !isView}
        errorMessage={errors.expenseDate?.message}
      />

      {/* 金額。閲覧モードでは readOnly、送信中は disabled。 */}
      <AppTextField
        {...register('amount', { valueAsNumber: true })}
        label="金額"
        type="number"
        inputProps={{ readOnly: isView, 'aria-label': '金額' }}
        disabled={isPending && !isView}
        errorMessage={errors.amount?.message}
      />

      {/* カテゴリ。閲覧モードでは AppSelect の readOnly prop でドロップダウンを開かせない（案 A ①）。
          disabled は送信中かつ閲覧モードでない場合のみ適用し、グレーアウトしない。 */}
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
            disabled={isPending && !isView}
            readOnly={isView}
          />
        )}
      />

      {/* 摘要。閲覧モードでは readOnly、送信中は disabled。 */}
      <AppTextField
        {...register('description')}
        label="摘要"
        multiline
        rows={3}
        inputProps={{ readOnly: isView, 'aria-label': '摘要' }}
        disabled={isPending && !isView}
        errorMessage={errors.description?.message}
      />

      {/* アクションボタン */}
      {!isView && (
        <>
          <SubmitButton label="保存する" loading={isPending} />
          {isAdd && onSaveAndContinue && (
            <Button
              type="button"
              variant="outlined"
              onClick={handleSaveAndContinue}
              disabled={isPending}
            >
              保存して続けて追加
            </Button>
          )}
          <Button
            type="button"
            variant="text"
            onClick={onCancel}
          >
            キャンセル
          </Button>
        </>
      )}
    </form>
  );
}
