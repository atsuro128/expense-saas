// サインアップフォームコンポーネント。
// React Hook Form + Zod (signupSchema) でクライアントサイドバリデーションを行い、
// 送信時に onSubmit コールバックを呼び出す。

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AppTextField from '../../components/ui/AppTextField';
import FormAlert from '../../components/ui/FormAlert';
import SubmitButton from '../../components/ui/SubmitButton';
import { signupSchema, type SignupInput } from './signupSchema';

export type { SignupInput };

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
 * React Hook Form + Zod でクライアントサイドバリデーションを実装する。
 */
export default function SignupForm({ onSubmit, apiError, isPending }: SignupFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    // フォーカスアウト時にバリデーションを発火する（画面仕様 §5 準拠）。
    mode: 'onBlur',
  });

  /** バリデーション通過後に data のみを onSubmit に渡すラッパー。 */
  const handleValidSubmit = (data: SignupInput) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleValidSubmit)} noValidate>
      <FormAlert message={apiError} severity="error" />
      {/* required: HTML5 required 属性を input にのみ付与（issue #140 案 A）。*/}
      <AppTextField
        {...register('company_name')}
        name="company_name"
        id="company_name"
        label="会社名"
        type="text"
        required
        disabled={isPending}
        errorMessage={errors.company_name?.message}
        sx={{ mb: 2 }}
      />
      <AppTextField
        {...register('user_name')}
        name="user_name"
        id="user_name"
        label="ユーザー名"
        type="text"
        required
        disabled={isPending}
        errorMessage={errors.user_name?.message}
        sx={{ mb: 2 }}
      />
      <AppTextField
        {...register('email')}
        name="email"
        id="email"
        label="メールアドレス"
        type="email"
        autoComplete="email"
        required
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
        autoComplete="new-password"
        required
        disabled={isPending}
        errorMessage={errors.password?.message}
        sx={{ mb: 2 }}
      />
      <SubmitButton label="新規登録" loading={isPending} />
    </form>
  );
}
