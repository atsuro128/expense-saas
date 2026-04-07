// フォーム上部にエラー・警告メッセージを Alert コンポーネントで表示する共通コンポーネント。
// message が null の場合は非表示。
// 認証画面ではトースト通知を使用しないため、API エラー表示はこのコンポーネントが担う。

import Alert from '@mui/material/Alert';

export type AlertSeverity = 'error' | 'warning' | 'info' | 'success';

export interface FormAlertProps {
  /** 表示するメッセージ。null の場合はコンポーネントを非表示にする。 */
  message: string | null;
  /** Alert の重要度。省略時は 'error'。 */
  severity?: AlertSeverity;
}

/**
 * FormAlert はフォーム上部にエラーメッセージを表示する。
 * message が null のときは何も描画しない。
 * 既存テストとの互換性のため data-severity 属性を付与する。
 */
export default function FormAlert({ message, severity = 'error' }: FormAlertProps) {
  if (message === null) {
    return null;
  }
  return (
    <Alert severity={severity} data-severity={severity} sx={{ mb: 2 }}>
      {message}
    </Alert>
  );
}
