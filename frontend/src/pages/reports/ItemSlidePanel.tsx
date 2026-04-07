// 明細スライドパネルコンポーネント（スタブ）。
// 明細の追加・編集・閲覧をスライドパネルで提供する。
// SCR-RPT-004 §6 に対応する。
// Step 9: スタブ実装。Step 10 で本実装に置き換える。

import type { ReportStatus, ExpenseItemWithAttachments } from '../../api/types';

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
}

/**
 * ItemSlidePanel は明細追加・編集・閲覧のスライドパネルコンポーネント。
 * open=true のとき表示され、mode に応じてフォームの入力可否を制御する。
 */
export default function ItemSlidePanel(_props: ItemSlidePanelProps) {
  return <div data-testid="item-slide-panel">NOT IMPLEMENTED</div>;
}
