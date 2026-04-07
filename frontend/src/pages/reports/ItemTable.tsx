// 明細テーブルコンポーネント（スタブ）。
// 明細データをテーブル形式で表示する。
// SCR-RPT-004 §5 に対応する。
// Step 9: スタブ実装。Step 10 で本実装に置き換える。

import type { ExpenseItemWithAttachments } from '../../api/types';

export interface ItemTableProps {
  /** 明細データ配列 */
  items: ExpenseItemWithAttachments[];
  /** 操作ボタンを表示するか（所有者 AND draft のみ） */
  canEditItems: boolean;
  /** 行クリックコールバック */
  onItemClick: (itemId: string) => void;
  /** 編集ボタン押下コールバック */
  onEditItem: (itemId: string) => void;
  /** 削除ボタン押下コールバック */
  onDeleteItem: (itemId: string) => void;
}

/**
 * ItemTable は明細データをテーブル形式で表示する。
 * 操作列（編集・削除ボタン）は canEditItems=true の場合のみ表示する。
 */
export default function ItemTable(_props: ItemTableProps) {
  return <div data-testid="item-table">NOT IMPLEMENTED</div>;
}
