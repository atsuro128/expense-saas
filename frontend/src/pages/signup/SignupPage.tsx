// サインアップ画面のページコンポーネント。
// AuthLayout でラップし、SignupForm を配置する。
// useSignup Hook を呼び出し、ミューテーション結果を SignupForm に伝播する。
// サインアップ成功時にトークンを AuthStore に保存し、ダッシュボードに遷移する。

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import AuthNavLinks from '../auth/AuthNavLinks';
import SignupForm, { type SignupInput } from './SignupForm';
import { useSignup } from '../../hooks/useSignup';
import { setTokens } from '../../stores/auth';
import { ApiClientError } from '../../api/client';

/**
 * SignupPage はサインアップ画面を描画するページコンポーネント。
 * 未実装スタブ: useSignup, AuthStore, ルーティング連携は実装後に動作する。
 */
export default function SignupPage() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const { mutateAsync, isPending } = useSignup();

  const handleSubmit = async (data: SignupInput) => {
    setApiError(null);
    try {
      const result = await mutateAsync({
        company_name: data.company_name,
        user_name: data.user_name,
        email: data.email,
        password: data.password,
      });
      setTokens(result.access_token, result.refresh_token);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setApiError(getSignupErrorMessage(err));
    }
  };

  return (
    <AuthLayout>
      <SignupForm onSubmit={handleSubmit} apiError={apiError} isPending={isPending} />
      <AuthNavLinks
        links={[{ prefix: '既にアカウントをお持ちの方は', label: 'ログイン', to: '/login' }]}
      />
    </AuthLayout>
  );
}

/** サインアップエラーのメッセージを返す（未実装スタブ）。 */
function getSignupErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === 'EMAIL_ALREADY_EXISTS') {
      return 'このメールアドレスは既に登録されています';
    }
    if (err.code === 'RATE_LIMIT_EXCEEDED') {
      return 'しばらく待ってから再試行してください';
    }
  }
  return 'サーバーエラーが発生しました';
}
