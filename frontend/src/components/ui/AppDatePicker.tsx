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
  /** 現在の日付値（YYYY-MM-DD 形式の文字列、または null） */
  value: string | null;
  /** 値変更時のコールバック */
  onChange: (value: string | null) => void;
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
 */
export default function AppDatePicker({
  name,
  label,
  value,
  onChange,
  errorMessage,
  required = false,
  disabled = false,
}: AppDatePickerProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val || null);
  };

  return (
    <TextField
      name={name}
      label={label}
      type="date"
      value={value ?? ''}
      onChange={handleChange}
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
