// Select ラッパーコンポーネント。
// size="small" と fullWidth をデフォルト化し、空選択肢のプレースホルダーを統一する。

import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';

/** 選択肢の定義 */
export interface SelectOption {
  /** 選択肢の値（API 送信値） */
  value: string;
  /** 選択肢の表示テキスト */
  label: string;
}

export interface AppSelectProps {
  /** フィールド名（フォームライブラリ連携用） */
  name: string;
  /** 表示ラベル */
  label: string;
  /** 選択肢一覧 */
  options: SelectOption[];
  /** 現在の選択値 */
  value: string;
  /** 値変更時のコールバック */
  onChange: (value: string) => void;
  /** プレースホルダーテキスト（未選択時に表示） */
  placeholder?: string;
  /** エラーメッセージ */
  errorMessage?: string;
  /** 必須フィールドか */
  required?: boolean;
  /** 無効化 */
  disabled?: boolean;
}

/**
 * AppSelect は MUI Select の共通ラッパー。
 * size="small" と fullWidth をデフォルトとして適用する。
 * 空選択肢のプレースホルダーを統一表示する。
 */
export default function AppSelect({
  name,
  label,
  options,
  value,
  onChange,
  placeholder,
  errorMessage,
  required = false,
  disabled = false,
}: AppSelectProps) {
  const labelId = `${name}-label`;

  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

  return (
    <FormControl
      size="small"
      fullWidth
      error={!!errorMessage}
      required={required}
      disabled={disabled}
    >
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        id={name}
        name={name}
        value={value}
        label={label}
        onChange={handleChange}
        displayEmpty={!!placeholder}
      >
        {/* 未選択時のプレースホルダー */}
        {placeholder && (
          <MenuItem value="">
            <em>{placeholder}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {errorMessage && <FormHelperText>{errorMessage}</FormHelperText>}
    </FormControl>
  );
}
