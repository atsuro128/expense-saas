// フォーム送信ボタン。送信中は disabled + スピナー表示。
// 認証画面・業務画面で共通利用する。

import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

export interface SubmitButtonProps {
  /** ボタンのラベルテキスト */
  label: string;
  /** 送信中フラグ（true の場合 disabled + スピナー表示） */
  loading: boolean;
  /** ボタンの type 属性（デフォルト: 'submit'） */
  type?: 'submit' | 'button';
  /** ボタンの MUI color（デフォルト: 'primary'） */
  color?: 'primary' | 'error' | 'success' | 'secondary';
  /** ボタンの variant（デフォルト: 'contained'） */
  variant?: 'contained' | 'outlined' | 'text';
  /** フル幅表示（デフォルト: true） */
  fullWidth?: boolean;
}

/**
 * SubmitButton はフォーム送信ボタンコンポーネント。
 * loading=true のとき disabled 状態でスピナーを表示する。
 * 既存テストとの互換性のため data-testid="spinner" を付与する。
 */
export default function SubmitButton({
  label,
  loading,
  type = 'submit',
  color = 'primary',
  variant = 'contained',
  fullWidth = true,
}: SubmitButtonProps) {
  return (
    <Button
      type={type}
      color={color}
      variant={variant}
      fullWidth={fullWidth}
      disabled={loading}
      aria-busy={loading}
      startIcon={
        loading ? (
          <CircularProgress
            size={16}
            color="inherit"
            data-testid="spinner"
          />
        ) : undefined
      }
    >
      {label}
    </Button>
  );
}
