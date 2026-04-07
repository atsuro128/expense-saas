// 明細一覧セクションヘッダーコンポーネント（スタブ）。
// 明細件数と「+ 明細追加」ボタンを横並びに配置する。
// SCR-RPT-004 §5 に対応する。
// Step 9: スタブ実装。Step 10 で本実装に置き換える。

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
export default function ItemListHeader(_props: ItemListHeaderProps) {
  return <div data-testid="item-list-header">NOT IMPLEMENTED</div>;
}
