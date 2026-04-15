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
   * 読み取り専用フラグ。
   * true のとき MUI Select のトップレベル readOnly prop でドロップダウンを開けなくする。
   * disabled と異なりグレーアウトしない。
   * 閲覧モード（mode='view'）でフィールドを disabled にせず readOnly にしたい場合に使用する。
   * a11y 対応のため inputProps.readOnly も併せて設定する。
   */
  readOnly?: boolean;
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
 * readOnly=true のとき Select のトップレベル readOnly prop でドロップダウンを開けなくする（案 A ①）。
 * MUI SelectInput.js L134/L296/L456 が readOnly をトップレベル prop から直接参照するため、
 * inputProps.readOnly のみでは SelectInput の開閉制御に効かない場合がある。
 * トップレベル readOnly を明示的に渡すことで確実に開閉制御を行う。
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
  readOnly = false,
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
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        id={name}
        name={name}
        value={value}
        label={label}
        onChange={handleChange}
        displayEmpty
        SelectDisplayProps={selectDisplayProps}
        readOnly={readOnly}
        inputProps={readOnly ? { readOnly: true } : undefined}
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
