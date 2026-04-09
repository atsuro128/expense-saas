// 明細スライドパネルコンポーネント。
// 明細の追加・編集・閲覧をスライドパネルで提供する。
// SCR-RPT-004 §6 に対応する。

import type { ReportStatus, ExpenseItemWithAttachments } from '../../api/types';
import ItemForm from './ItemForm';
import type { ItemFormValues } from './ItemForm';

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
  /** 送信中フラグ */
  isPending?: boolean;
  /** フォーム送信コールバック */
  onItemSubmit?: (data: ItemFormValues) => void;
  /** 「保存して続けて追加」フォームコールバック */
  onItemSaveAndContinue?: (data: ItemFormValues) => void;
}

/**
 * ItemSlidePanel は明細追加・編集・閲覧のスライドパネルコンポーネント。
 * open=true のとき表示され、mode に応じてフォームの入力可否を制御する。
 */
export default function ItemSlidePanel({
  open,
  mode,
  item,
  isOwner,
  reportStatus,
  onClose,
  onSaveSuccess,
  onSaveAndContinue: onSaveAndContinueProp,
  categories = [],
  apiError = null,
  isPending = false,
  onItemSubmit,
  onItemSaveAndContinue,
}: ItemSlidePanelProps) {
  // パネルモードに応じたタイトルを返す。
  const title = mode === 'add' ? '明細追加' : mode === 'edit' ? '明細編集' : '明細詳細';

  // 明細データから ItemFormValues を生成する。
  const defaultValues: ItemFormValues | undefined = item
    ? {
        expenseDate: item.expense_date,
        amount: item.amount,
        categoryId: item.category.id,
        description: item.description,
      }
    : undefined;

  // canModify: 所有者かつ draft 状態のときのみ明細編集が可能。
  const canModify = isOwner && reportStatus === 'draft';
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

  return (
    <div
      data-testid="item-slide-panel"
      style={{ display: open ? 'block' : 'none' }}
    >
      <div>
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
      <ItemForm
        mode={formMode}
        onSubmit={handleSubmit}
        onSaveAndContinue={handleSaveAndContinue}
        onCancel={onClose}
        categories={categories}
        apiError={apiError}
        isPending={isPending}
        defaultValues={defaultValues}
      />
    </div>
  );
}
