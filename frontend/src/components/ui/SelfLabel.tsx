// 自分が作成したレポートであることを示す「自分」ラベルコンポーネント。
// 申請者名の横に配置する。
// is_own_report フラグが true の場合のみ表示する。

import Chip from '@mui/material/Chip';

export interface SelfLabelProps {
  /** 自分のレポートかどうか（true の場合のみラベル表示） */
  isOwnReport: boolean;
}

/**
 * SelfLabel は自分が作成したレポートであることを示す「自分」ラベルを表示する。
 * isOwnReport が false の場合は何も描画しない。
 */
export default function SelfLabel({ isOwnReport }: SelfLabelProps) {
  if (!isOwnReport) {
    return null;
  }
  return <Chip label="自分" size="small" color="primary" variant="outlined" />;
}
