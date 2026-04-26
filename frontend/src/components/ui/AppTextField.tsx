// TextField ラッパーコンポーネント。
// size="small" と fullWidth をデフォルト化し、エラー表示ヘルパーを統一する。
// ui-guidelines.md §7 準拠。
// issue #140: required を分割代入し slotProps.htmlInput にのみ付与することで
// MUI の自動「*」付与を抑止しつつ HTML5 required 属性を input 要素に設定する。

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
 *
 * required は input 要素にのみ付与し、ラベルへの「*」付与を避ける（issue #140 案 A）。
 * MUI TextField の required prop をトップレベルで渡すとラベルに「*」が自動付与されるため、
 * required を分割代入し slotProps.htmlInput.required 経由で input にのみ設定する。
 *
 * 呼び出し側から inputProps（旧 API）が渡される場合は slotProps.htmlInput にマージする。
 * readOnly・aria-label 等の属性と required が共存できるようにする。
 */
export default function AppTextField({
  name,
  label,
  errorMessage,
  required,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  inputProps: legacyInputProps,
  slotProps,
  ...rest
}: AppTextFieldProps) {
  // 呼び出し側の slotProps.htmlInput を取り出す（型安全に処理する）。
  const callerHtmlInputProps =
    slotProps && typeof slotProps === 'object' && 'htmlInput' in slotProps
      ? (slotProps.htmlInput as Record<string, unknown>)
      : {};

  // legacyInputProps（inputProps 旧 API）と callerHtmlInputProps をマージし、
  // required を最後に設定することで確実に input 要素に付与する。
  // 優先順位: required（本コンポーネント設定） > callerHtmlInputProps > legacyInputProps
  const mergedHtmlInputProps = {
    ...(legacyInputProps as Record<string, unknown> | undefined),
    ...callerHtmlInputProps,
    required,
  };

  const mergedSlotProps: TextFieldProps['slotProps'] = {
    ...slotProps,
    htmlInput: mergedHtmlInputProps,
  };

  return (
    <TextField
      name={name}
      label={label}
      size="small"
      fullWidth
      error={!!errorMessage}
      helperText={errorMessage ?? rest.helperText}
      slotProps={mergedSlotProps}
      {...rest}
    />
  );
}
