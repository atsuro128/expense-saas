// 経費レポートのステータスを色分けした Chip で表示するコンポーネント。
// screens.md §4.8、ui-guidelines.md §5 準拠。

import Chip from '@mui/material/Chip';
import type { ChipProps } from '@mui/material/Chip';

/** 経費レポートのステータス（openapi.yaml ReportStatus に準拠） */
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

export interface StatusChipProps {
  /** レポートのステータス値 */
  status: ReportStatus;
}

/** ステータスと Chip の表示設定マッピング */
const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; color: ChipProps['color'] }
> = {
  draft: { label: '下書き', color: 'default' },
  submitted: { label: '提出済み', color: 'info' },
  approved: { label: '承認済み', color: 'success' },
  rejected: { label: '却下', color: 'error' },
  paid: { label: '支払済み', color: 'secondary' },
};

/**
 * StatusChip は経費レポートのステータスを色分けした Chip で表示する。
 */
export default function StatusChip({ status }: StatusChipProps) {
  const config = STATUS_CONFIG[status];
  return <Chip label={config.label} color={config.color} size="small" />;
}
