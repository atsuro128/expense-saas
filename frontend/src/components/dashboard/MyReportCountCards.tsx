// 自分のレポートステータス別件数カード群コンポーネント。
// Member / Approver / Accounting ロールで表示する。
// 55_ui_component/screens/dashboard.md §MyReportCountCards 準拠。

import Grid from '@mui/material/Grid2';
import CountCard from './CountCard';

export interface MyReportCountCardsProps {
  /** 下書きレポート件数 */
  draftCount: number;
  /** 提出中レポート件数 */
  submittedCount: number;
  /** 却下レポート件数 */
  rejectedCount: number;
}

/**
 * MyReportCountCards は自分のレポートをステータス別に集計した 3 枚のカードを表示する。
 */
export default function MyReportCountCards({
  draftCount,
  submittedCount,
  rejectedCount,
}: MyReportCountCardsProps) {
  return (
    <Grid container spacing={2} data-testid="my-report-count-cards">
      <Grid size={{ xs: 12, sm: 4 }}>
        <CountCard label="下書き" count={draftCount} href="/reports?status=draft" />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <CountCard label="提出中" count={submittedCount} href="/reports?status=submitted" />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <CountCard label="却下" count={rejectedCount} accentColor="error" href="/reports?status=rejected" />
      </Grid>
    </Grid>
  );
}
