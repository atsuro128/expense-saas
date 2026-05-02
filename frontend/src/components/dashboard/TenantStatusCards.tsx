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
    // PC 幅（md ≥ 900px）で 3 等分（md: 4、5 カードのため 3 + 2 の 2 行レイアウト）。
    // 他ロール（MyReportCountCards）の sm: 4 基準と整合させるため md: 2.4 → md: 4 に変更。
    // タブレット幅（sm）で 2 列折返し、モバイルで縦積み。
    // `md: 'auto'` はコンテンツ自然幅扱いで意図しない縮小を招くため使用しない。
    <Grid container spacing={2} data-testid="tenant-status-cards">
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <CountCard
          label="下書き"
          count={draftCount}
          accentColor="default"
          href="/reports/all?status=draft"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <CountCard
          label="提出済み"
          count={submittedCount}
          accentColor="info"
          href="/reports/all?status=submitted"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <CountCard
          label="承認済み"
          count={approvedCount}
          accentColor="success"
          href="/reports/all?status=approved"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <CountCard
          label="却下"
          count={rejectedCount}
          accentColor="error"
          href="/reports/all?status=rejected"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <CountCard
          label="支払済み"
          count={paidCount}
          accentColor="secondary"
          href="/reports/all?status=paid"
        />
      </Grid>
    </Grid>
  );
}
