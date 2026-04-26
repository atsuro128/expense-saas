// パスワードリセット要求フォームコンポーネント。
// React Hook Form + Zod (passwordResetRequestSchema) でバリデーションを行い、
// 送信時に onSubmit コールバックを呼び出す。

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AppTextField from '../../components/ui/AppTextField';
import FormAlert from '../../components/ui/FormAlert';
import SubmitButton from '../../components/ui/SubmitButton';
import {
  passwordResetRequestSchema,
  type PasswordResetRequestInput,
} from './passwordResetRequestSchema';

export type { PasswordResetRequestInput };

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
 * React Hook Form + Zod でクライアントサイドバリデーションを実装する。
 */
export default function PasswordResetRequestForm({
  onSubmit,
  apiError,
  isPending,
}: PasswordResetRequestFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
    // フォーカスアウト時にバリデーションを発火する（画面仕様 §5 準拠）。
    mode: 'onBlur',
  });

  /** バリデーション通過後に data のみを onSubmit に渡すラッパー。 */
  const handleValidSubmit = (data: PasswordResetRequestInput) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleValidSubmit)} noValidate>
      <FormAlert message={apiError} severity="error" />
      {/* required: HTML5 required 属性を input にのみ付与（issue #140 案 A）。*/}
      <AppTextField
        {...register('email')}
        name="email"
        id="email"
        label="メールアドレス"
        type="email"
        required
        disabled={isPending}
        errorMessage={errors.email?.message}
        sx={{ mb: 2 }}
      />
      <SubmitButton label="送信" loading={isPending} />
    </form>
  );
}
