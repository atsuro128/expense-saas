// 表示件数セレクタコンポーネント。
// 1 ページあたりの表示件数（per_page）を選択する UI。
// common-components.md §PageSizeSelector 準拠。
// 標準選択肢 [10, 20, 50, 100] をデフォルトとし、URL 由来の標準外値が現在値として渡された場合は
// 動的に選択肢に追加して URL を正直に反映する（issue #147 採用方針 A: パターン X）。

import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';

/** PageSizeSelector のデフォルト標準選択肢 */
const DEFAULT_STANDARD_OPTIONS = [10, 20, 50, 100];

export interface PageSizeSelectorProps {
  /** 現在の表示件数（URL クエリ `per_page` に対応する整数） */
  perPage: number;
  /** 標準選択肢。デフォルト [10, 20, 50, 100] */
  standardOptions?: number[];
  /** 表示件数変更時のコールバック（呼び出し側で URL 更新と page=1 リセットを行う） */
  onPerPageChange: (size: number) => void;
  /** ローディング中などで無効化 */
  disabled?: boolean;
}

/**
 * PageSizeSelector は MUI Select ベースの表示件数セレクタ。
 * 標準外の per_page 値が渡された場合は動的に選択肢に追加する。
 * Set による重複除去で MUI MenuItem の key 重複 warning を回避する。
 */
export default function PageSizeSelector({
  perPage,
  standardOptions = DEFAULT_STANDARD_OPTIONS,
  onPerPageChange,
  disabled = false,
}: PageSizeSelectorProps) {
  // 動的選択肢の構築: perPage が standardOptions に含まれない場合は追加して昇順ソート。
  // Set による重複除去で key 重複 warning を回避する（issue #147 重要リスク 1）。
  const options = Array.from(new Set([...standardOptions, perPage])).sort((a, b) => a - b);

  const handleChange = (event: SelectChangeEvent<number>) => {
    onPerPageChange(Number(event.target.value));
  };

  const labelId = 'page-size-selector-label';

  return (
    <FormControl size="small" disabled={disabled} data-testid="page-size-selector">
      <InputLabel id={labelId}>表示件数:</InputLabel>
      <Select<number>
        labelId={labelId}
        id="page-size-selector-select"
        value={perPage}
        label="表示件数:"
        onChange={handleChange}
        inputProps={{ 'data-testid': 'page-size-selector-input' }}
      >
        {options.map((size) => (
          <MenuItem key={size} value={size} data-testid={`page-size-option-${size}`}>
            {size} 件
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
