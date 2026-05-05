// Select ラッパーコンポーネント。
// size="small" と fullWidth をデフォルト化し、空選択肢のプレースホルダーを統一する。

import type { HTMLAttributes } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
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
   * フォーカスアウト時のコールバック。
   * React Hook Form の Controller が渡す field.onBlur を受け取り、
   * MUI Select の onBlur に配線する。バリデーション即時表示に使用する。
   */
  onBlur?: () => void;
  /**
   * MUI Select の SelectDisplayProps。
   * data-testid 等のカスタムデータ属性を display div に設定したい場合に使用する。
   * HTMLAttributes に加えてカスタムデータ属性（data-*）を受け付ける。
   */
  selectDisplayProps?: HTMLAttributes<HTMLDivElement> & { [key: string]: unknown };
  /**
   * FormControl に渡す MUI sx prop。
   * フィルタエリアで width を指定する場合に使用する（例: `sx={{ width: 140 }}`）。
   */
  sx?: SxProps<Theme>;
}

/**
 * AppSelect は MUI Select の共通ラッパー。
 * size="small" と fullWidth をデフォルトとして適用する。
 * 空選択肢のプレースホルダーを統一表示する。
 * readOnly=true のとき Select のトップレベル readOnly prop でドロップダウンを開けなくする（案 A ①）。
 * MUI SelectInput.js L134/L296/L456 が readOnly をトップレベル prop から直接参照するため、
 * inputProps.readOnly のみでは SelectInput の開閉制御に効かない場合がある。
 * トップレベル readOnly を明示的に渡すことで確実に開閉制御を行う。
 *
 * issue #140 案 A: required は FormControl ではなく Select の inputProps にのみ付与する。
 * FormControl required を削除することで InputLabel への「*」自動付与を抑止し、
 * inputProps.required + inputProps['aria-required'] で input 要素にのみ a11y 属性を設定する。
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
  onBlur,
  sx,
}: AppSelectProps) {
  const labelId = `${name}-label`;

  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

  // placeholder がある場合、または options に value='' の選択肢が含まれる場合は
  // displayEmpty=true を維持する。
  // MUI Select は displayEmpty=false のとき value="" を「未選択」扱いにして
  // 表示要素を描画しないため、{ value: '', label: '...' } を持つ既存フィルタで
  // 初期値 "" を表示できなくなる回帰を防ぐ。
  const hasEmptyValueOption = options.some((opt) => opt.value === '');
  const shouldDisplayEmpty = !!placeholder || hasEmptyValueOption;

  // displayEmpty=true のとき MUI OutlinedInput は「表示要素あり」と見なし
  // notched=true（ラベル幅ぶんの切り欠き）を常に開く。
  // InputLabel 側も shrink=true にしてラベルを上部に固定しないと
  // 「ラベルが内側にいるのに切り欠きが空いている」という視覚不整合が発生する。
  // shouldDisplayEmpty=true かつ value="" のとき shrink=true を明示する。
  // 値が選択済み（value !== ""）の場合は MUI のデフォルト挙動に委ねる。
  const shouldShrink = shouldDisplayEmpty && value === '' ? true : undefined;

  // required と readOnly を input 要素にのみ設定する（issue #140 案 A）。
  // FormControl の required を削除して InputLabel の「*」自動付与を抑止する。
  // aria-required を明示的に付与し、FormControl required 削除後も a11y を確保する。
  // aria-required は Booleanish 型（true | false）のため boolean 値で渡す。
  const selectInputProps = {
    ...(readOnly ? { readOnly: true } : {}),
    ...(required ? { required: true, 'aria-required': true as const } : {}),
  };

  return (
    <FormControl
      size="small"
      fullWidth={fullWidth}
      error={!!errorMessage}
      disabled={disabled}
      sx={sx}
    >
      <InputLabel id={labelId} shrink={shouldShrink}>
        {label}
      </InputLabel>
      <Select
        labelId={labelId}
        id={name}
        name={name}
        value={value}
        label={label}
        onChange={handleChange}
        onBlur={onBlur}
        displayEmpty={shouldDisplayEmpty}
        SelectDisplayProps={selectDisplayProps}
        readOnly={readOnly}
        inputProps={Object.keys(selectInputProps).length > 0 ? selectInputProps : undefined}
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
