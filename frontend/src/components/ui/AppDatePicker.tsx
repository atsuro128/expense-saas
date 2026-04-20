// 日付入力コンポーネント。
// MUI TextField + type="date" を使い、name 属性を設定して
// テスト時に document.querySelector('input[name="..."]') でアクセス可能にする。
// ui-guidelines.md §7 準拠。

import TextField from '@mui/material/TextField';

export interface AppDatePickerProps {
  /** フィールド名（フォームライブラリ連携用・input の name 属性として使用） */
  name: string;
  /** 表示ラベル */
  label: string;
  /** 現在の日付値（YYYY-MM-DD 形式の文字列。未入力時は空文字） */
  value: string;
  /** 値変更時のコールバック（空入力時は空文字を返す） */
  onChange: (value: string) => void;
  /** フォーカスアウト時のコールバック（RHF 連携用） */
  onBlur?: () => void;
  /** エラーメッセージ */
  errorMessage?: string;
  /** 必須フィールドか */
  required?: boolean;
  /** 無効化 */
  disabled?: boolean;
}

/**
 * AppDatePicker は日付入力フィールドを提供する。
 * MUI TextField + type="date" を使い、native の日付入力として機能させる。
 * name 属性を input に設定し、テストで document.querySelector('input[name="..."]') が機能する。
 * 空入力時は null ではなく空文字を返すことで、Zod スキーマの string 型と整合させる。
 */
export default function AppDatePicker({
  name,
  label,
  value,
  onChange,
  onBlur,
  errorMessage,
  required = false,
  disabled = false,
}: AppDatePickerProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 空文字をそのまま返す（null 変換しない）。
    // Zod の z.string().min(1, ...) がカスタム日本語メッセージで発火する。
    onChange(e.target.value);
  };

  return (
    <TextField
      name={name}
      label={label}
      type="date"
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      size="small"
      fullWidth
      disabled={disabled}
      error={!!errorMessage}
      helperText={errorMessage}
      slotProps={{
        inputLabel: { shrink: true },
        // required は input 要素にのみ設定し、ラベルへの「*」付与を避ける。
        // getByLabelText('開始日') 等のラベル完全一致クエリが機能するようにするため。
        htmlInput: { required },
      }}
    />
  );
}
