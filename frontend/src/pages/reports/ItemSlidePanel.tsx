// 明細スライドパネルコンポーネント。
// 明細の追加・編集・閲覧をスライドパネルで提供する。
// SCR-RPT-004 §6 に対応する。

import Button from '@mui/material/Button';
import type { ReportStatus, ExpenseItemWithAttachments } from '../../api/types';
import ItemForm from './ItemForm';
import type { ItemFormValues } from './ItemForm';
import AttachmentArea from './AttachmentArea';

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
  onItemSubmit,
  onItemSaveAndContinue,
}: ItemSlidePanelProps) {
  // パネルモードに応じたタイトルを返す。
  const title = mode === 'add' ? '明細追加' : mode === 'edit' ? '明細編集' : '明細詳細';

  // 明細データから ItemFormValues を生成する。
  const defaultValues: ItemFormValues | undefined = item
    ? {
        expenseDate: item.expense_date.slice(0, 10),
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
        <Button variant="text" size="small" onClick={onClose}>
          閉じる
        </Button>
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
      {/* 添付ファイル管理領域。追加モードで明細未保存（item=null）の場合は非表示になる。 */}
      <AttachmentArea
        reportId={reportId}
        itemId={item?.id ?? null}
        canModify={canModify}
      />
    </div>
  );
}
