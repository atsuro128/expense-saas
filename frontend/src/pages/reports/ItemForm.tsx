// 明細フォームコンポーネント。
// 明細の入力フォーム。React Hook Form + Zod でバリデーションを行う。
// SCR-RPT-004 §6 に対応する。

import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import type { PanelMode } from './ItemSlidePanel';
import FormAlert from '../../components/ui/FormAlert';

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
 * mode='view' のとき全フィールドが readonly になる。
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

      {/* 支出日 */}
      <div>
        <label htmlFor="item-form-date">日付</label>
        <input
          id="item-form-date"
          type="date"
          readOnly={isView}
          disabled={isPending && !isView}
          {...register('expenseDate')}
          aria-label="日付"
        />
        {errors.expenseDate && <span role="alert">{errors.expenseDate.message}</span>}
      </div>

      {/* 金額 */}
      <div>
        <label htmlFor="item-form-amount">金額</label>
        <input
          id="item-form-amount"
          type="number"
          readOnly={isView}
          disabled={isPending && !isView}
          {...register('amount', { valueAsNumber: true })}
          aria-label="金額"
        />
        {errors.amount && <span role="alert">{errors.amount.message}</span>}
      </div>

      {/* カテゴリ */}
      <div>
        <label htmlFor="item-form-category">カテゴリ</label>
        <select
          id="item-form-category"
          disabled={isView || (isPending && !isView)}
          {...register('categoryId')}
          aria-label="カテゴリ"
        >
          <option value="">カテゴリを選択</option>
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        {errors.categoryId && <span role="alert">{errors.categoryId.message}</span>}
      </div>

      {/* 摘要 */}
      <div>
        <label htmlFor="item-form-desc">摘要</label>
        <textarea
          id="item-form-desc"
          readOnly={isView}
          disabled={isPending && !isView}
          {...register('description')}
          aria-label="摘要"
        />
        {errors.description && <span role="alert">{errors.description.message}</span>}
      </div>

      {/* アクションボタン */}
      {!isView && (
        <div>
          <button type="submit" disabled={isPending}>
            保存する
          </button>
          {isAdd && onSaveAndContinue && (
            <button type="button" onClick={handleSaveAndContinue} disabled={isPending}>
              保存して続けて追加
            </button>
          )}
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      )}
    </form>
  );
}
