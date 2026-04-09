// 明細一覧セクションヘッダーコンポーネント。
// 明細件数と「+ 明細追加」ボタンを横並びに配置する。
// SCR-RPT-004 §5 に対応する。

export interface ItemListHeaderProps {
  /** 明細件数 */
  itemCount: number;
  /** 明細追加ボタンを表示するか */
  canAddItem: boolean;
  /** 明細追加ボタン押下コールバック */
  onAddItem: () => void;
}

/**
 * ItemListHeader は明細セクションのヘッダー。
 * 「明細一覧（N件）」と「明細追加」ボタンを表示する。
 */
export default function ItemListHeader({ itemCount, canAddItem, onAddItem }: ItemListHeaderProps) {
  return (
    <div data-testid="item-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3>明細一覧（{itemCount}件）</h3>
      {canAddItem && (
        <button type="button" onClick={onAddItem}>
          明細追加
        </button>
      )}
    </div>
  );
}
