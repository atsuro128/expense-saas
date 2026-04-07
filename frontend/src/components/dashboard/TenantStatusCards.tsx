// テナント全体のレポートステータス別件数カード群コンポーネント。
// Admin ロールのみで表示する。
// 55_ui_component/screens/dashboard.md §TenantStatusCards 準拠。

import Grid from '@mui/material/Grid2';
import CountCard from './CountCard';

export interface TenantStatusCardsProps {
  /** テナント全体の下書き件数 */
  draftCount: number;
  /** テナント全体の提出済み件数 */
  submittedCount: number;
  /** テナント全体の承認済み件数 */
  approvedCount: number;
  /** テナント全体の却下件数 */
  rejectedCount: number;
  /** テナント全体の支払済み件数 */
  paidCount: number;
}

/**
 * TenantStatusCards はテナント全体のレポートをステータス別に集計した 5 枚のカードを表示する。
 * Admin ロール向けのコンポーネント。
 */
export default function TenantStatusCards({
  draftCount,
  submittedCount,
  approvedCount,
  rejectedCount,
  paidCount,
}: TenantStatusCardsProps) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4, md: 'auto' }}>
        <CountCard
          label="下書き"
          count={draftCount}
          accentColor="default"
          href="/admin/reports?status=draft"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4, md: 'auto' }}>
        <CountCard
          label="提出済み"
          count={submittedCount}
          accentColor="info"
          href="/admin/reports?status=submitted"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4, md: 'auto' }}>
        <CountCard
          label="承認済み"
          count={approvedCount}
          accentColor="success"
          href="/admin/reports?status=approved"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4, md: 'auto' }}>
        <CountCard
          label="却下"
          count={rejectedCount}
          accentColor="error"
          href="/admin/reports?status=rejected"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4, md: 'auto' }}>
        <CountCard
          label="支払済み"
          count={paidCount}
          accentColor="secondary"
          href="/admin/reports?status=paid"
        />
      </Grid>
    </Grid>
  );
}
