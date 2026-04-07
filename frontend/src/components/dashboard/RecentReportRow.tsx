// 直近レポート一覧の 1 行コンポーネント。
// タイトル（リンク付き）、対象期間、合計金額、ステータスバッジを横に並べる。
// 55_ui_component/screens/dashboard.md §RecentReportRow 準拠。

import { Link } from 'react-router-dom';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import MuiLink from '@mui/material/Link';
import StatusChip from '../ui/StatusChip';
import type { ReportStatus } from '../ui/StatusChip';

export interface RecentReportRowProps {
  /** レポートID（遷移先 URL 生成用） */
  id: string;
  /** レポートタイトル */
  title: string;
  /** 対象期間開始日（YYYY-MM-DD） */
  periodStart: string;
  /** 対象期間終了日（YYYY-MM-DD） */
  periodEnd: string;
  /** 合計金額（円） */
  totalAmount: number;
  /** ステータス */
  status: ReportStatus;
}

/**
 * YYYY-MM-DD を YYYY/MM/DD 形式に変換する。
 */
function formatDate(date: string): string {
  return date.replace(/-/g, '/');
}

/**
 * 金額を「¥1,234,567」形式に変換する。
 */
function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/**
 * RecentReportRow は直近レポート一覧の 1 行を表示する。
 */
export default function RecentReportRow({
  id,
  title,
  periodStart,
  periodEnd,
  totalAmount,
  status,
}: RecentReportRowProps) {
  return (
    <TableRow>
      <TableCell>
        <MuiLink component={Link} to={`/reports/${id}`} underline="hover">
          {title}
        </MuiLink>
      </TableCell>
      <TableCell>
        {formatDate(periodStart)} - {formatDate(periodEnd)}
      </TableCell>
      <TableCell align="right">{formatAmount(totalAmount)}</TableCell>
      <TableCell>
        <StatusChip status={status} />
      </TableCell>
    </TableRow>
  );
}
