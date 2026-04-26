// パスワードリセット実行画面のページコンポーネント。
// URL パラメータからトークンを取得し、useExecutePasswordReset を呼び出す。
// viewState で 'form' / 'complete' / 'token-invalid' を切り替える。

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import AuthNavLinks from '../auth/AuthNavLinks';
import PasswordResetForm, { type PasswordResetInput } from './PasswordResetForm';
import PasswordResetComplete from './PasswordResetComplete';
import PasswordResetTokenInvalid from './PasswordResetTokenInvalid';
import { useExecutePasswordReset } from '../../hooks/useExecutePasswordReset';
import { ApiClientError } from '../../api/client';

/** パスワードリセット実行画面の表示状態。 */
type ViewState = 'form' | 'complete' | 'token-invalid';

/**
 * PasswordResetPage はパスワードリセット実行画面を描画するページコンポーネント。
 * 未実装スタブ: useExecutePasswordReset 連携は実装後に動作する。
 */
export default function PasswordResetPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [viewState, setViewState] = useState<ViewState>('form');
  const [apiError, setApiError] = useState<string | null>(null);

  const { mutateAsync, isPending } = useExecutePasswordReset();

  const handleSubmit = async (data: PasswordResetInput) => {
    setApiError(null);
    try {
      await mutateAsync({ token, new_password: data.new_password });
      setViewState('complete');
    } catch (err: unknown) {
      // INVALID_TOKEN（無効なトークン）と TOKEN_EXPIRED（期限切れトークン）の両方で
      // トークン無効画面に遷移する（BE の TOKEN_EXPIRED 対応への防御的対応）。
      if (
        err instanceof ApiClientError &&
        (err.code === 'INVALID_TOKEN' || err.code === 'TOKEN_EXPIRED')
      ) {
        setViewState('token-invalid');
      } else {
        setApiError(getErrorMessage(err));
      }
    }
  };

  return (
    <AuthLayout>
      {viewState === 'form' && (
        <>
          <PasswordResetForm onSubmit={handleSubmit} apiError={apiError} isPending={isPending} />
          <AuthNavLinks links={[{ label: 'ログイン画面に戻る', to: '/login' }]} />
        </>
      )}
      {viewState === 'complete' && <PasswordResetComplete />}
      {viewState === 'token-invalid' && <PasswordResetTokenInvalid />}
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
