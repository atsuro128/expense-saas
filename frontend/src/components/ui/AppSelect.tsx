// Select ラッパーコンポーネント。
// size="small" と fullWidth をデフォルト化し、空選択肢のプレースホルダーを統一する。

import type { HTMLAttributes } from 'react';
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
  /**
   * FormControl の fullWidth を制御する。
   * デフォルト true（後方互換性維持）。
   * フィルタ等、幅を制限したい場合は false を指定する。
   */
  fullWidth?: boolean;
  /**
   * MUI Select の SelectDisplayProps。
   * data-testid 等のカスタムデータ属性を display div に設定したい場合に使用する。
   * HTMLAttributes に加えてカスタムデータ属性（data-*）を受け付ける。
   */
  selectDisplayProps?: HTMLAttributes<HTMLDivElement> & { [key: string]: unknown };
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
  fullWidth = true,
  selectDisplayProps,
}: AppSelectProps) {
  const labelId = `${name}-label`;

  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

  return (
    <FormControl
      size="small"
      fullWidth={fullWidth}
      error={!!errorMessage}
      required={required}
      disabled={disabled}
    >
      {/*
       * placeholder がある場合のみ shrink を明示する。
       * displayEmpty=true のとき MUI OutlinedInput は「表示要素あり」と見なし
       * notched=true（ラベル幅ぶんの切り欠き）を常に開く。
       * InputLabel 側も shrink=true にしてラベルを上部に固定しないと
       * 「ラベルが内側にいるのに切り欠きが空いている」という視覚不整合が発生する。
       * placeholder がない場合は shrink={undefined} にして MUI デフォルト挙動に戻す。
       */}
      <InputLabel id={labelId} shrink={placeholder ? true : undefined}>
        {label}
      </InputLabel>
      <Select
        labelId={labelId}
        id={name}
        name={name}
        value={value}
        label={label}
        onChange={handleChange}
        displayEmpty={!!placeholder}
        SelectDisplayProps={selectDisplayProps}
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
