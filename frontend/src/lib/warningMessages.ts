/**
 * 警告メッセージ定数（エラーではなく、ユーザー確認を求める警告）。
 * state-management.md §6.5.6 に準拠する。
 * ConfirmDialog の message プロパティに渡す。
 * API エラーコードには対応しない（クライアント側の条件判定で表示する）。
 */
export const WARNING_MESSAGES = {
  /**
   * 明細日付がレポートの対象期間外の場合の警告。
   * 対応ポリシー: policies.md ITM-007（警告のみ、エラーにしない）
   * 表示タイミング: 明細追加・編集の保存ボタン押下時に expense_date が
   *   report.period_start / period_end の範囲外の場合、保存処理の前に ConfirmDialog で表示する。
   *   View mode（閲覧時）では保存操作が存在しないため表示しない。
   */
  ITEM_DATE_OUTSIDE_PERIOD_WARNING:
    '明細日付がレポートの対象期間外です。入力を確認してください。',
} as const;
