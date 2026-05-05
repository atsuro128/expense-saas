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
      {/* required: HTML5 required 属性を input にのみ付与（issue #140 案 A）。*/}
      {/*
       * type="text" + inputMode="email" の組み合わせ（issue #171 追加対応）。
       * type="email" のままにすると Chromium/Edge の Autofill API 経路（連絡先帳メアド候補）に
       * 流れ、autoComplete="username" によるパスワードマネージャー候補表示が抑制される。
       * type="text" にすることでパスワードマネージャー候補表示経路に乗せつつ、
       * inputMode="email" でモバイル端末の @ キー付きキーボードを維持する。
       * HTML5 type=email ネイティブ検証は LoginForm が noValidate を設定済みのため実害なし。
       * Zod (loginSchema) でクライアントサイドバリデーションを実施しているため問題なし。
       */}
      <AppTextField
        {...register('email')}
        name="email"
        id="email"
        label="メールアドレス"
        type="text"
        inputProps={{ inputMode: 'email' }}
        autoComplete="username"
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
        autoComplete="current-password"
        required
        disabled={isPending}
        errorMessage={errors.password?.message}
        sx={{ mb: 2 }}
      />
      <SubmitButton label="ログイン" loading={isPending} />
    </form>
  );
}
