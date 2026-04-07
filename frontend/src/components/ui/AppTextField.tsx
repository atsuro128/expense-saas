// TextField ラッパーコンポーネント。
// size="small" と fullWidth をデフォルト化し、エラー表示ヘルパーを統一する。
// ui-guidelines.md §7 準拠。

import TextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material';

export interface AppTextFieldProps extends Omit<TextFieldProps, 'size' | 'fullWidth'> {
  /** フィールド名（フォームライブラリ連携用） */
  name: string;
  /** 表示ラベル */
  label: string;
  /** エラーメッセージ（存在する場合、error=true + helperText にセット） */
  errorMessage?: string;
}

/**
 * AppTextField は MUI TextField の共通ラッパー。
 * size="small" と fullWidth をデフォルトとして適用する。
 * errorMessage を指定すると自動的に error=true + helperText が設定される。
 */
export default function AppTextField({
  name,
  label,
  errorMessage,
  ...rest
}: AppTextFieldProps) {
  return (
    <TextField
      name={name}
      label={label}
      size="small"
      fullWidth
      error={!!errorMessage}
      helperText={errorMessage ?? rest.helperText}
      {...rest}
    />
  );
}
