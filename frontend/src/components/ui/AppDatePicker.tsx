// DatePicker ラッパーコンポーネント。
// 日本語ロケール（ja）、YYYY/MM/DD フォーマット、size="small" をデフォルト化する。
// ui-guidelines.md §7 準拠。

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';

export interface AppDatePickerProps {
  /** フィールド名（フォームライブラリ連携用） */
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
 * AppDatePicker は MUI DatePicker の共通ラッパー。
 * 日本語ロケール・YYYY/MM/DD フォーマット・size="small" をデフォルトで適用する。
 * 値は YYYY-MM-DD 形式の文字列で受け渡しを行う。
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
  // 文字列を dayjs オブジェクトに変換
  const dayjsValue = value ? dayjs(value) : null;

  const handleChange = (newValue: dayjs.Dayjs | null) => {
    if (newValue === null) {
      onChange(null);
    } else if (newValue.isValid()) {
      // YYYY-MM-DD 形式で返す
      onChange(newValue.format('YYYY-MM-DD'));
    } else {
      onChange(null);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ja">
      <DatePicker
        label={label}
        value={dayjsValue}
        onChange={handleChange}
        disabled={disabled}
        format="YYYY/MM/DD"
        slotProps={{
          textField: {
            name,
            size: 'small',
            fullWidth: true,
            required,
            error: !!errorMessage,
            helperText: errorMessage,
          },
        }}
      />
    </LocalizationProvider>
  );
}
