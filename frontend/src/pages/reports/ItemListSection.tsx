// 明細一覧セクションコンポーネント。
// ItemListHeader と ItemTable を統合し、明細 0 件時は EmptyState を表示する。
// SCR-RPT-004 §5 に対応する。

import type { ReportStatus, ExpenseItemWithAttachments } from '../../api/types';
import ItemListHeader from './ItemListHeader';
import ItemTable from './ItemTable';

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
 * 明細 0 件のとき EmptyState（「明細はまだ追加されていません」メッセージ）を表示する。
 * draft 状態かつ所有者の場合のみ「明細追加」ボタンを表示する。
 */
export default function ItemListSection({
  items,
  isOwner,
  status,
  onAddItem,
  onItemClick,
  onEditItem,
  onDeleteItem,
}: ItemListSectionProps) {
  // draft 状態かつ所有者の場合のみ明細の追加・編集・削除が可能。
  const canEditItems = isOwner && status === 'draft';

  return (
    <div data-testid="item-list-section">
      <ItemListHeader
        itemCount={items.length}
        canAddItem={canEditItems}
        onAddItem={onAddItem}
      />
      {items.length === 0 ? (
        <div data-testid="item-list-empty">
          <p>明細はまだ追加されていません</p>
        </div>
      ) : (
        <ItemTable
          items={items}
          canEditItems={canEditItems}
          onItemClick={onItemClick}
          onEditItem={onEditItem}
          onDeleteItem={onDeleteItem}
        />
      )}
    </div>
  );
}
