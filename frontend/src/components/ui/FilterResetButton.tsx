// フィルタ条件をリセットするボタンコンポーネント。
// フィルタが適用されている場合にのみ有効化される。

import Button from '@mui/material/Button';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

export interface FilterResetButtonProps {
  /** リセットコールバック */
  onReset: () => void;
  /** フィルタが適用中かどうか（false の場合 disabled） */
  isFiltered: boolean;
}

/**
 * FilterResetButton はフィルタ条件をリセットするボタンを表示する。
 * isFiltered が false の場合は disabled 状態になる。
 */
export default function FilterResetButton({ onReset, isFiltered }: FilterResetButtonProps) {
  return (
    <Button
      variant="outlined"
      color="primary"
      startIcon={<FilterAltOffIcon />}
      onClick={onReset}
      disabled={!isFiltered}
    >
      フィルタをリセット
    </Button>
  );
}
