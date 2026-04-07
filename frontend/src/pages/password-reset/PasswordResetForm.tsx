// パスワードリセット実行フォームコンポーネント。
// React Hook Form + Zod (passwordResetSchema) でバリデーションを行い、
// 送信時に onSubmit コールバックを呼び出す。
// confirm_password は API に送信せず、フロントエンドのみのバリデーション用。

import FormAlert from '../../components/ui/FormAlert';
import SubmitButton from '../../components/ui/SubmitButton';

/** パスワードリセット実行フォームの入力値。 */
export interface PasswordResetInput {
  /** 新しいパスワード（API に送信する）。 */
  new_password: string;
}

export interface PasswordResetFormProps {
  /** フォーム送信時のコールバック。バリデーション通過後に呼ばれる。 */
  onSubmit: (data: PasswordResetInput) => void;
  /** API エラーメッセージ（フォーム上部に Alert 表示）。null の場合は非表示。 */
  apiError: string | null;
  /** 送信中フラグ（ボタン・入力フィールドの disabled 制御）。 */
  isPending: boolean;
}

/**
 * PasswordResetForm はパスワードリセット実行フォームを描画する。
 * 新しいパスワードと確認用パスワードの入力フィールドを含む。
 * 未実装スタブ: 実装後に react-hook-form + zod を使用する。
 */
export default function PasswordResetForm({ onSubmit, apiError, isPending }: PasswordResetFormProps) {
  // 未実装スタブ。
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const new_password = (form.elements.namedItem('new_password') as HTMLInputElement)?.value ?? '';
    // confirm_password は API に送信しない。
    onSubmit({ new_password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormAlert message={apiError} severity="error" />
      <div>
        <label htmlFor="new_password">新しいパスワード</label>
        <input id="new_password" name="new_password" type="password" disabled={isPending} />
      </div>
      <div>
        <label htmlFor="confirm_password">パスワード（確認）</label>
        <input id="confirm_password" name="confirm_password" type="password" disabled={isPending} />
      </div>
      <SubmitButton label="パスワードを変更する" loading={isPending} />
    </form>
  );
}
