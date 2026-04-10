// ログインフォームコンポーネント。
// React Hook Form + Zod (loginSchema) でクライアントサイドバリデーションを行い、
// 送信時に onSubmit コールバックを呼び出す。

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AppTextField from '../../components/ui/AppTextField';
import FormAlert from '../../components/ui/FormAlert';
import SubmitButton from '../../components/ui/SubmitButton';
import { loginSchema, type LoginInput } from './loginSchema';

export type { LoginInput };

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
 * React Hook Form + Zod でクライアントサイドバリデーションを実装する。
 */
export default function LoginForm({ onSubmit, apiError, isPending }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    // フォーカスアウト時にバリデーションを発火する（画面仕様 §5 準拠）。
    mode: 'onBlur',
  });

  /** バリデーション通過後に data のみを onSubmit に渡すラッパー。 */
  const handleValidSubmit = (data: LoginInput) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleValidSubmit)} noValidate>
      <FormAlert message={apiError} severity="error" />
      <AppTextField
        {...register('email')}
        name="email"
        id="email"
        label="メールアドレス"
        type="email"
        disabled={isPending}
        errorMessage={errors.email?.message}
        sx={{ mb: 2 }}
      />
      <AppTextField
        {...register('password')}
        name="password"
        id="password"
        label="パスワード"
        type="password"
        disabled={isPending}
        errorMessage={errors.password?.message}
        sx={{ mb: 2 }}
      />
      <SubmitButton label="ログイン" loading={isPending} />
    </form>
  );
}
