// レポート一覧画面のヘッダーコンポーネント（スタブ）。
// 「マイレポート」タイトルと「+ レポート作成」ボタンを表示する。
// SCR-RPT-001 に対応する。

import Button from '@mui/material/Button';

export interface ReportListHeaderProps {
  /** レポート作成ボタン押下時のコールバック */
  onCreateReport: () => void;
}

/**
 * ReportListHeader はレポート一覧のページタイトルと作成ボタンを表示する。
 */
export default function ReportListHeader({ onCreateReport }: ReportListHeaderProps) {
  return (
    <div>
      <h1>マイレポート</h1>
      <Button variant="contained" onClick={onCreateReport}>
        + レポート作成
      </Button>
    </div>
  );
}
