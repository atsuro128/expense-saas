// ログインフォームコンポーネント。
// React Hook Form + Zod (loginSchema) でクライアントサイドバリデーションを行い、
// 送信時に onSubmit コールバックを呼び出す。

import TextField from '@mui/material/TextField';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  });

  /** バリデーション通過後に data のみを onSubmit に渡すラッパー。 */
  const handleValidSubmit = (data: LoginInput) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleValidSubmit)} noValidate>
      <FormAlert message={apiError} severity="error" />
      <TextField
        {...register('email')}
        id="email"
        label="メールアドレス"
        type="email"
        fullWidth
        disabled={isPending}
        error={!!errors.email}
        helperText={errors.email?.message}
        sx={{ mb: 2 }}
      />
      <TextField
        {...register('password')}
        id="password"
        label="パスワード"
        type="password"
        fullWidth
        disabled={isPending}
        error={!!errors.password}
        helperText={errors.password?.message}
        sx={{ mb: 2 }}
      />
      <SubmitButton label="ログイン" loading={isPending} />
    </form>
  );
}
