// ログインフォームコンポーネント。
// React Hook Form + Zod (loginSchema) でクライアントサイドバリデーションを行い、
// 送信時に onSubmit コールバックを呼び出す。

import FormAlert from '../../components/ui/FormAlert';
import SubmitButton from '../../components/ui/SubmitButton';

/** ログインフォームの入力値。 */
export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginFormProps {
  /** フォーム送信時のコールバック。バリデーション通過後に呼ばれる。 */
  onSubmit: (data: LoginInput) => void;
  /** API エラーメッセージ（フォーム上部に Alert 表示）。null の場合は非表示。 */
  apiError: string | null;
  /** 送信中フラグ（ボタン・入力フィールドの disabled 制御）。 */
  isPending: boolean;
}

/**
 * LoginForm はログインフォームを描画する。
 * メールアドレスとパスワードの入力フィールド、送信ボタンを含む。
 * 未実装スタブ: 実装後に react-hook-form + zod を使用する。
 */
export default function LoginForm({ onSubmit, apiError, isPending }: LoginFormProps) {
  // 未実装スタブ。
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value ?? '';
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? '';
    onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormAlert message={apiError} severity="error" />
      <div>
        <label htmlFor="email">メールアドレス</label>
        <input id="email" name="email" type="email" disabled={isPending} />
      </div>
      <div>
        <label htmlFor="password">パスワード</label>
        <input id="password" name="password" type="password" disabled={isPending} />
      </div>
      <SubmitButton label="ログイン" loading={isPending} />
    </form>
  );
}
