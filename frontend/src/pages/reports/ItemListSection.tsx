// 明細一覧セクションコンポーネント（スタブ）。
// ItemListHeader と ItemTable を統合し、明細 0 件時は EmptyState を表示する。
// SCR-RPT-004 §5 に対応する。
// Step 9: スタブ実装。Step 10 で本実装に置き換える。

import type { ReportStatus, ExpenseItemWithAttachments } from '../../api/types';

export interface ItemListSectionProps {
  /** 明細データ配列 */
  items: ExpenseItemWithAttachments[];
  /** 所有者フラグ */
  isOwner: boolean;
  /** レポートステータス */
  status: ReportStatus;
  /** 明細追加ボタン押下コールバック */
  onAddItem: () => void;
  /** 明細行クリックコールバック */
  onItemClick: (itemId: string) => void;
  /** 明細編集ボタン押下コールバック */
  onEditItem: (itemId: string) => void;
  /** 明細削除ボタン押下コールバック */
  onDeleteItem: (itemId: string) => void;
}

/**
 * ItemListSection は経費明細一覧セクションのコンテナコンポーネント。
 * 明細 0 件のとき EmptyState を表示する。
 */
export default function ItemListSection(_props: ItemListSectionProps) {
  return <div data-testid="item-list-section">NOT IMPLEMENTED</div>;
}
