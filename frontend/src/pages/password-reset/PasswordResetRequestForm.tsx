// パスワードリセット要求フォームコンポーネント。
// React Hook Form + Zod (passwordResetRequestSchema) でバリデーションを行い、
// 送信時に onSubmit コールバックを呼び出す。

import FormAlert from '../../components/ui/FormAlert';
import SubmitButton from '../../components/ui/SubmitButton';

/** パスワードリセット要求フォームの入力値。 */
export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetRequestFormProps {
  /** フォーム送信時のコールバック。バリデーション通過後に呼ばれる。 */
  onSubmit: (data: PasswordResetRequestInput) => void;
  /** API エラーメッセージ（フォーム上部に Alert 表示）。null の場合は非表示。 */
  apiError: string | null;
  /** 送信中フラグ（ボタン・入力フィールドの disabled 制御）。 */
  isPending: boolean;
}

/**
 * PasswordResetRequestForm はパスワードリセット要求フォームを描画する。
 * メールアドレス入力フィールドと送信ボタンを含む。
 * 未実装スタブ: 実装後に react-hook-form + zod を使用する。
 */
export default function PasswordResetRequestForm({
  onSubmit,
  apiError,
  isPending,
}: PasswordResetRequestFormProps) {
  // 未実装スタブ。
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value ?? '';
    onSubmit({ email });
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormAlert message={apiError} severity="error" />
      <div>
        <label htmlFor="email">メールアドレス</label>
        <input id="email" name="email" type="email" disabled={isPending} />
      </div>
      <SubmitButton label="送信" loading={isPending} />
    </form>
  );
}
