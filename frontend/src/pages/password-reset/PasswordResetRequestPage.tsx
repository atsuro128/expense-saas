// パスワードリセット要求画面のページコンポーネント。
// メールアドレスを入力してリセットメールを送信する。
// 送信後は完了メッセージ画面に切り替える（isSubmitted フラグで制御）。

import { useState } from 'react';
import AuthLayout from '../../components/layout/AuthLayout';
import AuthNavLinks from '../auth/AuthNavLinks';
import PasswordResetRequestForm, { type PasswordResetRequestInput } from './PasswordResetRequestForm';
import PasswordResetRequestComplete from './PasswordResetRequestComplete';
import { useRequestPasswordReset } from '../../hooks/useRequestPasswordReset';
import { ApiClientError } from '../../api/client';

/**
 * PasswordResetRequestPage はパスワードリセット要求画面を描画するページコンポーネント。
 * 未実装スタブ: useRequestPasswordReset 連携は実装後に動作する。
 */
export default function PasswordResetRequestPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { mutateAsync, isPending } = useRequestPasswordReset();

  const handleSubmit = async (data: PasswordResetRequestInput) => {
    setApiError(null);
    try {
      await mutateAsync({ email: data.email });
      setIsSubmitted(true);
    } catch (err: unknown) {
      setApiError(getErrorMessage(err));
    }
  };

  return (
    <AuthLayout>
      {isSubmitted ? (
        <PasswordResetRequestComplete />
      ) : (
        <PasswordResetRequestForm onSubmit={handleSubmit} apiError={apiError} isPending={isPending} />
      )}
      <AuthNavLinks links={[{ label: 'ログイン画面に戻る', to: '/login' }]} />
    </AuthLayout>
  );
}

/** エラーメッセージを返す（未実装スタブ）。 */
function getErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === 'RATE_LIMIT_EXCEEDED') {
      return 'しばらく待ってから再試行してください';
    }
  }
  return 'サーバーエラーが発生しました';
}
