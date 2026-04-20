/**
 * API エラーコードに対応するユーザー向け日本語メッセージ。
 * state-management.md §6.5.2 の ERROR_MESSAGES に準拠する。
 * security.md §8.4 の全エラーコードをカバーする。
 *
 * 文言の出典:
 * - INTERNAL_ERROR: auth-login.md §5 S3, auth-password-reset-request.md §5 S1,
 *                   report-detail.md §11, workflow-pending.md §11, workflow-payable.md §11
 * - FORBIDDEN: report-detail.md §11（403）
 * - RESOURCE_NOT_FOUND: report-detail.md §11（404）, report-edit.md §6
 * - CONFLICT: report-detail.md §11（409）, report-edit.md §7
 * - RATE_LIMIT_EXCEEDED: 汎用メッセージ（画面固有の上書きは state-management.md §6.5.6 参照）
 */
export const SERVER_ERROR_MESSAGES = {
  // 400 不正リクエスト
  BAD_REQUEST:
    'リクエストの形式が正しくありません。',
  VALIDATION_ERROR:
    '入力内容に誤りがあります。各項目を確認してください。',

  // 401 認証エラー
  UNAUTHORIZED:
    '認証が必要です。再度ログインしてください。',
  INVALID_CREDENTIALS:
    'メールアドレスまたはパスワードが正しくありません',
  INVALID_TOKEN:
    '認証情報が無効です。再度ログインしてください。',
  TOKEN_EXPIRED:
    '認証の有効期限が切れました。再度ログインしてください。',

  // 403 権限エラー
  FORBIDDEN:
    'この操作を行う権限がありません。',
  SELF_APPROVAL_NOT_ALLOWED:
    '自分のレポートは承認できません',
  SELF_PAYMENT_NOT_ALLOWED:
    '自分が作成したレポートの支払完了は記録できません',

  // 404 リソース未検出
  RESOURCE_NOT_FOUND:
    '指定されたデータが見つかりません。',

  // 409 競合
  CONFLICT:
    '他のユーザーがこのレポートを更新しました。ページを再読み込みしてください。',

  // 413 ファイルサイズ超過
  FILE_TOO_LARGE:
    'ファイルサイズは5MB以下にしてください',

  // 422 業務ルール違反
  INVALID_STATE_TRANSITION:
    'この状態遷移は許可されていません。',
  REPORT_NOT_EDITABLE:
    '提出済みのレポートは編集できません',
  REPORT_NOT_DELETABLE:
    '提出済みのレポートは削除できません',
  EMPTY_REPORT_SUBMISSION:
    '明細を1件以上追加してから提出してください',
  NO_APPROVER_IN_TENANT:
    '承認者が登録されていないため提出できません',
  INVALID_PERIOD:
    '開始日は終了日以前を指定してください',
  INVALID_AMOUNT:
    '金額は正の整数で入力してください',
  INVALID_FILE_TYPE:
    'JPEG, PNG, PDF のみアップロード可能です',
  MISSING_REJECTION_REASON:
    '却下理由を入力してください',

  // 429 レート制限超過
  RATE_LIMIT_EXCEEDED:
    'しばらく待ってから再試行してください',

  // 500 サーバー内部エラー
  INTERNAL_ERROR:
    'サーバーとの通信に失敗しました。しばらくしてから再度お試しください。',
} as const;

/**
 * HTTP ステータスコードから API エラーコードを推定する。
 * JSON レスポンスのパースに失敗した場合（非 JSON の 500 等）に使用する。
 *
 * - 500 / 502 / 503 / 504 → INTERNAL_ERROR
 * - 429 → RATE_LIMIT_EXCEEDED
 * - 404 → RESOURCE_NOT_FOUND
 * - 403 → FORBIDDEN
 * - 409 → CONFLICT
 * - 422 → VALIDATION_ERROR
 * - その他想定外 → INTERNAL_ERROR
 */
export function inferCodeFromStatus(status: number): string {
  switch (status) {
    case 500:
    case 502:
    case 503:
    case 504:
      return 'INTERNAL_ERROR';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 403:
      return 'FORBIDDEN';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    default:
      return 'INTERNAL_ERROR';
  }
}
