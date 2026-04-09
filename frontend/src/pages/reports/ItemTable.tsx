// 明細テーブルコンポーネント。
// 明細データをテーブル形式で表示する。
// SCR-RPT-004 §5 に対応する。

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
 * 編集・削除ボタンのクリックはイベント伝播を停止し、行クリックを発火しない。
 */
export default function ItemTable({ items, canEditItems, onItemClick, onEditItem, onDeleteItem }: ItemTableProps) {
  return (
    <table data-testid="item-table">
      <thead>
        <tr>
          <th>日付</th>
          <th>金額</th>
          <th>カテゴリ</th>
          <th>摘要</th>
          <th>添付数</th>
          {canEditItems && <th>操作</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            data-testid={`item-row-${item.id}`}
            onClick={() => onItemClick(item.id)}
            style={{ cursor: 'pointer' }}
          >
            <td>{item.expense_date}</td>
            <td>{item.amount.toLocaleString()}</td>
            <td>{item.category.name_ja}</td>
            <td>{item.description}</td>
            <td>{item.attachments.length}</td>
            {canEditItems && (
              <td>
                <button
                  type="button"
                  onClick={(e) => {
                    // 行クリックが発火しないようにイベント伝播を停止する。
                    e.stopPropagation();
                    onEditItem(item.id);
                  }}
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    // 行クリックが発火しないようにイベント伝播を停止する。
                    e.stopPropagation();
                    onDeleteItem(item.id);
                  }}
                >
                  削除
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
