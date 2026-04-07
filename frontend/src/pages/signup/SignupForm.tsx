// サインアップフォームコンポーネント。
// React Hook Form + Zod (signupSchema) でクライアントサイドバリデーションを行い、
// 送信時に onSubmit コールバックを呼び出す。

import FormAlert from '../../components/ui/FormAlert';
import SubmitButton from '../../components/ui/SubmitButton';

/** サインアップフォームの入力値。 */
export interface SignupInput {
  company_name: string;
  user_name: string;
  email: string;
  password: string;
}

export interface SignupFormProps {
  /** フォーム送信時のコールバック。バリデーション通過後に呼ばれる。 */
  onSubmit: (data: SignupInput) => void;
  /** API エラーメッセージ（フォーム上部に Alert 表示）。null の場合は非表示。 */
  apiError: string | null;
  /** 送信中フラグ（ボタン・入力フィールドの disabled 制御）。 */
  isPending: boolean;
}

/**
 * SignupForm はサインアップフォームを描画する。
 * 会社名、ユーザー名、メールアドレス、パスワードの入力フィールドを含む。
 * 未実装スタブ: 実装後に react-hook-form + zod を使用する。
 */
export default function SignupForm({ onSubmit, apiError, isPending }: SignupFormProps) {
  // 未実装スタブ。
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const company_name = (form.elements.namedItem('company_name') as HTMLInputElement)?.value ?? '';
    const user_name = (form.elements.namedItem('user_name') as HTMLInputElement)?.value ?? '';
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value ?? '';
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? '';
    onSubmit({ company_name, user_name, email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormAlert message={apiError} severity="error" />
      <div>
        <label htmlFor="company_name">会社名</label>
        <input id="company_name" name="company_name" type="text" disabled={isPending} />
      </div>
      <div>
        <label htmlFor="user_name">ユーザー名</label>
        <input id="user_name" name="user_name" type="text" disabled={isPending} />
      </div>
      <div>
        <label htmlFor="email">メールアドレス</label>
        <input id="email" name="email" type="email" disabled={isPending} />
      </div>
      <div>
        <label htmlFor="password">パスワード</label>
        <input id="password" name="password" type="password" disabled={isPending} />
      </div>
      <SubmitButton label="新規登録" loading={isPending} />
    </form>
  );
}
