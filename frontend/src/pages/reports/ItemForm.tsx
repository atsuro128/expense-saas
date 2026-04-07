// 明細フォームコンポーネント（スタブ）。
// 明細の入力フォーム。React Hook Form + Zod でバリデーションを行う。
// SCR-RPT-004 §6 に対応する。
// Step 9: スタブ実装。Step 10 で本実装に置き換える。

import type { PanelMode } from './ItemSlidePanel';

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
 * ItemForm は明細追加・編集・閲覧フォームコンポーネント。
 * mode='view' のとき全フィールドが readonly になる。
 * mode='add' のとき「保存して続けて追加」ボタンも表示する。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ItemForm(_props: ItemFormProps) {
  return <div data-testid="item-form">NOT IMPLEMENTED</div>;
}
