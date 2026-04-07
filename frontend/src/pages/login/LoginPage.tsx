// ログイン画面のページコンポーネント。
// AuthLayout でラップし、LoginForm を配置する。
// useLogin Hook を呼び出し、ミューテーション結果を LoginForm に伝播する。
// ログイン成功時にトークンを AuthStore に保存し、ダッシュボード（またはリダイレクト元）に遷移する。

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import AuthNavLinks from '../auth/AuthNavLinks';
import LoginForm, { type LoginInput } from './LoginForm';
import { useLogin } from '../../hooks/useLogin';
import { setTokens } from '../../stores/auth';

/**
 * LoginPage はログイン画面を描画するページコンポーネント。
 * 未実装スタブ: useLogin, AuthStore, ルーティング連携は実装後に動作する。
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = useState<string | null>(null);

  const { mutateAsync, isPending } = useLogin();

  const handleSubmit = async (data: LoginInput) => {
    setApiError(null);
    try {
      const result = await mutateAsync(data);
      setTokens(result.access_token, result.refresh_token);
      const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(from, { replace: true });
    } catch (err: unknown) {
      // エラーコードに応じてメッセージを設定する（実装後）。
      setApiError(getLoginErrorMessage(err));
    }
  };

  return (
    <AuthLayout>
      <LoginForm onSubmit={handleSubmit} apiError={apiError} isPending={isPending} />
      <AuthNavLinks
        links={[
          { prefix: 'アカウントをお持ちでない方は', label: '新規登録', to: '/signup' },
          { prefix: 'パスワードを忘れた方は', label: 'パスワードリセット', to: '/password-reset' },
        ]}
      />
    </AuthLayout>
  );
}

/** ログインエラーのメッセージを返す（未実装スタブ）。 */
function getLoginErrorMessage(err: unknown): string {
  if (err instanceof Error && 'code' in err) {
    const code = (err as { code: string }).code;
    if (code === 'RATE_LIMIT_EXCEEDED') {
      return 'しばらく待ってから再試行してください';
    }
  }
  // SEC-011: 認証失敗は統一メッセージで返す。
  return 'メールアドレスまたはパスワードが正しくありません';
}
