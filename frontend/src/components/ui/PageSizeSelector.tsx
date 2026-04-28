// 表示件数セレクタコンポーネント。
// 1 ページあたりの表示件数（per_page）を選択する UI。
// common-components.md §PageSizeSelector 準拠（issue #147 B 案: ラベル完全撤去）。
// 標準選択肢 [10, 20, 50, 100] をデフォルトとし、URL 由来の標準外値が現在値として渡された場合は
// 動的に選択肢に追加して URL を正直に反映する（issue #147 採用方針 A: パターン X）。
//
// サイズ・variant 方針（A1 案確定、B 案でラベル撤去）:
// - size="small": MUI Select 標準の小サイズ（フッター高さを最小化）
// - variant="standard": MUI X DataGrid 標準フッター（@mui/material/TablePagination）の Select と揃える
//   （TablePagination.js L260 でハードコード確認済み。issue #147 再々オープン A1 案）
//   下線のみの薄い見た目になり、フッター内で枠線が目立たない
// - FormControl に margin="none" + sx={{ my: 0 }}: 余白を完全排除し minHeight: 52 を Select 枠線が支配しないよう調整
// - ラベル撤去後のアクセシビリティ: inputProps に aria-label="表示件数" を付与（B 案確定）
//   「20 件」「50 件」等の「件」表記で文脈が分かるためビジュアルラベルは不要と判断（SMK-081）

import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';

/** PageSizeSelector のデフォルト標準選択肢 */
const DEFAULT_STANDARD_OPTIONS = [10, 20, 50, 100];

/**
 * FormControl に適用する sx 定数（A1 案確定値）。
 * テストから直接参照できるよう named export する（APF-011 スタイル回帰防止）。
 * margin="none" と組み合わせて Select 枠線が AppPaginationFooter の minHeight を支配しないよう余白を排除する。
 */
export const PAGE_SIZE_SELECTOR_FORM_CONTROL_SX = { my: 0 } as const;

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
 *
 * A1 案確定: variant="standard" / FormControl margin="none" + sx={{ my: 0 }} で
 * Select 枠線が AppPaginationFooter の minHeight: 52 を支配しないようにする。
 * MUI X DataGrid 標準フッター（TablePagination）の Select と variant を揃えて MUI 標準寄せとする。
 *
 * B 案確定（issue #147 B 案）: ビジュアルラベル（InputLabel）を撤去。
 * 「20 件」「50 件」等の「件」表記で文脈が分かるため floating label は不要（SMK-081 指摘対応）。
 * アクセシビリティは inputProps の aria-label="表示件数" で担保する。
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

  return (
    <FormControl
      size="small"
      disabled={disabled}
      margin="none"
      sx={PAGE_SIZE_SELECTOR_FORM_CONTROL_SX}
      data-testid="page-size-selector"
    >
      <Select<number>
        id="page-size-selector-select"
        value={perPage}
        variant="standard"
        onChange={handleChange}
        inputProps={{
          'data-testid': 'page-size-selector-input',
          'aria-label': '表示件数',
        }}
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
