// 直近レポート一覧コンポーネント。
// 自分が作成した直近 5 件のレポートを一覧表示する。
// 55_ui_component/screens/dashboard.md §RecentReportList 準拠。

import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import MuiLink from '@mui/material/Link';
import EmptyState from '../ui/EmptyState';
import RecentReportRow from './RecentReportRow';
import type { ReportStatus } from '../ui/StatusChip';

export interface RecentReport {
  /** レポートID */
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

export interface RecentReportListProps {
  /** 直近レポート一覧（最大5件） */
  reports: RecentReport[];
}

/**
 * RecentReportList は直近の経費レポートを最大 5 件表示する。
 * 0 件の場合は EmptyState を表示する。
 */
export default function RecentReportList({ reports }: RecentReportListProps) {
  return (
    <Box>
      {reports.length === 0 ? (
        <EmptyState message="経費レポートはまだありません。レポートを作成して経費精算を始めましょう。" />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="最近の経費レポート">
            <TableBody>
              {reports.map((report) => (
                <RecentReportRow
                  key={report.id}
                  id={report.id}
                  title={report.title}
                  periodStart={report.periodStart}
                  periodEnd={report.periodEnd}
                  totalAmount={report.totalAmount}
                  status={report.status}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Box sx={{ mt: 1, textAlign: 'right' }}>
        <MuiLink component={Link} to="/reports" underline="hover">
          すべてのレポートを見る
        </MuiLink>
      </Box>
    </Box>
  );
}
