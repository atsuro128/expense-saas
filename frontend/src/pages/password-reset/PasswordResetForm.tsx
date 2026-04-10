// パスワードリセット実行フォームコンポーネント。
// React Hook Form + Zod (passwordResetSchema) でバリデーションを行い、
// 送信時に onSubmit コールバックを呼び出す。
// confirm_password は API に送信せず、フロントエンドのみのバリデーション用。

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AppTextField from '../../components/ui/AppTextField';
import FormAlert from '../../components/ui/FormAlert';
import SubmitButton from '../../components/ui/SubmitButton';
import { passwordResetSchema, type PasswordResetSchemaInput } from './passwordResetSchema';

/** パスワードリセット実行フォームの入力値（API 送信用: confirm_password を除く）。 */
export interface PasswordResetInput {
  /** 新しいパスワード（API に送信する）。 */
  new_password: string;
}

export interface PasswordResetFormProps {
  /** フォーム送信時のコールバック。バリデーション通過後に呼ばれる（new_password のみ）。 */
  onSubmit: (data: PasswordResetInput) => void;
  /** API エラーメッセージ（フォーム上部に Alert 表示）。null の場合は非表示。 */
  apiError: string | null;
  /** 送信中フラグ（ボタン・入力フィールドの disabled 制御）。 */
  isPending: boolean;
}

/**
 * PasswordResetForm はパスワードリセット実行フォームを描画する。
 * 新しいパスワードと確認用パスワードの入力フィールドを含む。
 * confirm_password はフロントエンドのみのバリデーション用で、API には送信しない。
 * React Hook Form + Zod でクライアントサイドバリデーションを実装する。
 */
export default function PasswordResetForm({ onSubmit, apiError, isPending }: PasswordResetFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetSchemaInput>({
    resolver: zodResolver(passwordResetSchema),
    // フォーカスアウト時にバリデーションを発火する（画面仕様 §5 準拠）。
    mode: 'onBlur',
  });

  /** バリデーション通過後に new_password のみを onSubmit に渡すラッパー。 */
  const handleValidSubmit = (data: PasswordResetSchemaInput) => {
    // confirm_password は API に送信しない。
    onSubmit({ new_password: data.new_password });
  };

  return (
    <form onSubmit={handleSubmit(handleValidSubmit)} noValidate>
      <FormAlert message={apiError} severity="error" />
      <AppTextField
        {...register('new_password')}
        name="new_password"
        id="new_password"
        label="新しいパスワード"
        type="password"
        disabled={isPending}
        errorMessage={errors.new_password?.message}
        sx={{ mb: 2 }}
      />
      <AppTextField
        {...register('confirm_password')}
        name="confirm_password"
        id="confirm_password"
        label="確認用パスワード"
        type="password"
        disabled={isPending}
        errorMessage={errors.confirm_password?.message}
        sx={{ mb: 2 }}
      />
      <SubmitButton label="パスワードを変更する" loading={isPending} />
    </form>
  );
}
