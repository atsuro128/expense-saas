// レポート作成ボタンコンポーネント（スタブ）。
// SCR-RPT-001 に対応する。

export interface CreateReportButtonProps {
  /** ボタン押下時のコールバック */
  onClick: () => void;
}

/**
 * CreateReportButton は「+ レポート作成」ボタンを表示する。
 */
export default function CreateReportButton({ onClick }: CreateReportButtonProps) {
  return (
    <button type="button" onClick={onClick}>
      + レポート作成
    </button>
  );
}
