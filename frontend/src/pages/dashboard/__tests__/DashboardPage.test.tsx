// DashboardPage コンポーネントのユニットテスト。
// DSH-FE-001〜DSH-FE-007 に対応する。
// DSH-FE-039: issue 088（403 認可エラーフィードバック）のリダイレクトトースト表示確認テストを追加。

import { type ReactNode } from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import DashboardPage from '../DashboardPage';
import * as useDashboardModule from '../../../hooks/useDashboard';
import * as useCurrentUserModule from '../../../hooks/useCurrentUser';
import type { DashboardResponse } from '../../../api/types';
import { ApiClientError } from '../../../api/client';

// useDashboard と useCurrentUser をモック化する。
vi.mock('../../../hooks/useDashboard');
vi.mock('../../../hooks/useCurrentUser');

/** テスト用 QueryClient を生成する。 */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

/** 指定ロールとダッシュボードデータで DashboardPage をレンダリングするヘルパー。 */
function renderDashboard(role: string, dashboardData: DashboardResponse) {
  (useCurrentUserModule.useCurrentUser as Mock).mockReturnValue({
    data: { data: { role, name: 'Test User', id: 'user-1', email: 'test@example.com', tenant: { id: 't-1', name: 'Test' } } },
    isLoading: false,
    error: null,
  });
  (useDashboardModule.useDashboard as Mock).mockReturnValue({
    data: { data: dashboardData },
    isLoading: false,
    error: null,
  });
  const Wrapper = createWrapper();
  return render(<DashboardPage />, { wrapper: Wrapper });
}

/**
 * navigate state 付きで DashboardPage をレンダリングするヘルパー（issue 088 テスト用）。
 * MemoryRouter の initialEntries に state を乗せることで navigate 遷移後の状態を再現する。
 */
function renderDashboardWithLocationState(
  role: string,
  dashboardData: DashboardResponse,
  locationState: unknown,
) {
  (useCurrentUserModule.useCurrentUser as Mock).mockReturnValue({
    data: { data: { role, name: 'Test User', id: 'user-1', email: 'test@example.com', tenant: { id: 't-1', name: 'Test' } } },
    isLoading: false,
    error: null,
  });
  (useDashboardModule.useDashboard as Mock).mockReturnValue({
    data: { data: dashboardData },
    isLoading: false,
    error: null,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/dashboard', state: locationState }]}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// FE テスト用フィクスチャ。
const mockDashboardMember: DashboardResponse = {
  my_draft_count: 2,
  my_submitted_count: 1,
  my_rejected_count: 1,
  recent_reports: [
    {
      id: 'rpt-001',
      title: '4月交通費',
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      total_amount: 15000,
      status: 'draft',
      updated_at: '2026-04-01T00:00:00Z',
    },
  ],
};

const mockDashboardApprover: DashboardResponse = {
  ...mockDashboardMember,
  pending_approval_count: 3,
  monthly_summary: [
    { year_month: '2026-04', total_amount: 150000 },
    { year_month: '2026-03', total_amount: 120000 },
    { year_month: '2026-02', total_amount: 80000 },
  ],
};

const mockDashboardAccounting: DashboardResponse = {
  ...mockDashboardMember,
  pending_payment_count: 2,
  monthly_summary: [
    { year_month: '2026-04', total_amount: 150000 },
  ],
};

const mockDashboardAdmin: DashboardResponse = {
  tenant_draft_count: 5,
  tenant_submitted_count: 3,
  tenant_approved_count: 2,
  tenant_rejected_count: 1,
  tenant_paid_count: 4,
  tenant_member_count: 10,
  monthly_summary: [
    { year_month: '2026-04', total_amount: 150000 },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // DSH-FE-001: Member ロールで MyReportCountCards が表示され、TenantStatusCards / MonthlySummaryTable が表示されないこと。
  it('DSH-FE-001: Member ロールで MyReportCountCards が表示され、TenantStatusCards は表示されない', () => {
    renderDashboard('member', mockDashboardMember);

    // MyReportCountCards の各カードが表示されること。
    // RecentReportList のステータスチップと区別するため、MyReportCountCards 領域に絞ってクエリする。
    const countCardsSection = screen.getByTestId('my-report-count-cards');
    expect(within(countCardsSection).getByText('下書き')).toBeInTheDocument();
    expect(within(countCardsSection).getByText('提出中')).toBeInTheDocument();
    expect(within(countCardsSection).getByText('却下')).toBeInTheDocument();

    // TenantStatusCards（テナント全体集計）が表示されないこと。
    expect(screen.queryByText('提出済み')).not.toBeInTheDocument();
    expect(screen.queryByText('支払済み')).not.toBeInTheDocument();

    // MonthlySummaryTable が表示されないこと。
    expect(screen.queryByText('年月')).not.toBeInTheDocument();
  });

  // DSH-FE-002: Member ロールで RecentReportList が表示され、承認待ちカード / 支払待ちカードが表示されないこと。
  it('DSH-FE-002: Member ロールで RecentReportList が表示され、承認待ちカード / 支払待ちカードは表示されない', () => {
    renderDashboard('member', mockDashboardMember);

    // RecentReportList が表示されること（「すべてのレポートを見る」リンク）。
    expect(screen.getByText('すべてのレポートを見る')).toBeInTheDocument();

    // 承認待ちカード / 支払待ちカードが表示されないこと。
    expect(screen.queryByText('承認待ち')).not.toBeInTheDocument();
    expect(screen.queryByText('支払待ち')).not.toBeInTheDocument();
  });

  // DSH-FE-003: Approver ロールで MyReportCountCards + 承認待ちカード + MonthlySummaryTable + RecentReportList が表示されること。
  it('DSH-FE-003: Approver ロールで承認待ちカードと MonthlySummaryTable が表示される', () => {
    renderDashboard('approver', mockDashboardApprover);

    // MyReportCountCards が表示されること。
    // RecentReportList のステータスチップと区別するため、MyReportCountCards 領域に絞ってクエリする。
    const countCardsSection = screen.getByTestId('my-report-count-cards');
    expect(within(countCardsSection).getByText('下書き')).toBeInTheDocument();

    // 承認待ちカードが表示されること。
    expect(screen.getByText('承認待ち')).toBeInTheDocument();

    // 承認待ちカードのリンク先が /approvals（SCR-WFL-001）であること。
    const approvalLink = screen.getByText('承認待ち').closest('a');
    expect(approvalLink).toHaveAttribute('href', '/approvals');

    // MonthlySummaryTable が表示されること（テーブルヘッダーで確認）。
    expect(screen.getByText('年月')).toBeInTheDocument();
    expect(screen.getByText('合計金額')).toBeInTheDocument();

    // RecentReportList が表示されること。
    expect(screen.getByText('すべてのレポートを見る')).toBeInTheDocument();

    // 支払待ちカード / TenantStatusCards が表示されないこと。
    expect(screen.queryByText('支払待ち')).not.toBeInTheDocument();
    expect(screen.queryByText('提出済み')).not.toBeInTheDocument();
  });

  // DSH-FE-004: Accounting ロールで MyReportCountCards + 支払待ちカード + MonthlySummaryTable + RecentReportList が表示されること。
  it('DSH-FE-004: Accounting ロールで支払待ちカードと MonthlySummaryTable が表示される', () => {
    renderDashboard('accounting', mockDashboardAccounting);

    // MyReportCountCards が表示されること。
    // RecentReportList のステータスチップと区別するため、MyReportCountCards 領域に絞ってクエリする。
    const countCardsSection = screen.getByTestId('my-report-count-cards');
    expect(within(countCardsSection).getByText('下書き')).toBeInTheDocument();

    // 支払待ちカードが表示されること。
    expect(screen.getByText('支払待ち')).toBeInTheDocument();

    // 支払待ちカードのリンク先が /payments（SCR-WFL-002）であること。
    const paymentLink = screen.getByText('支払待ち').closest('a');
    expect(paymentLink).toHaveAttribute('href', '/payments');

    // MonthlySummaryTable が表示されること。
    expect(screen.getByText('年月')).toBeInTheDocument();

    // RecentReportList が表示されること。
    expect(screen.getByText('すべてのレポートを見る')).toBeInTheDocument();

    // 承認待ちカード / TenantStatusCards が表示されないこと。
    expect(screen.queryByText('承認待ち')).not.toBeInTheDocument();
    expect(screen.queryByText('提出済み')).not.toBeInTheDocument();
  });

  // DSH-FE-005: Admin ロールで TenantStatusCards + メンバー数カード + MonthlySummaryTable が表示され、
  //             MyReportCountCards / RecentReportList / 承認待ちカード / 支払待ちカードが表示されないこと。
  it('DSH-FE-005: Admin ロールで TenantStatusCards と MonthlySummaryTable が表示される', () => {
    renderDashboard('admin', mockDashboardAdmin);

    // TenantStatusCards が表示されること（5 ステータスのカード）。
    expect(screen.getByText('提出済み')).toBeInTheDocument();
    expect(screen.getByText('承認済み')).toBeInTheDocument();
    expect(screen.getByText('支払済み')).toBeInTheDocument();

    // メンバー数カードが表示されること。
    expect(screen.getByText('メンバー数')).toBeInTheDocument();

    // MonthlySummaryTable が表示されること。
    expect(screen.getByText('年月')).toBeInTheDocument();

    // MyReportCountCards / RecentReportList が表示されないこと。
    expect(screen.queryByText('提出中')).not.toBeInTheDocument();
    expect(screen.queryByText('すべてのレポートを見る')).not.toBeInTheDocument();
    expect(screen.queryByText('承認待ち')).not.toBeInTheDocument();
    expect(screen.queryByText('支払待ち')).not.toBeInTheDocument();
  });

  // DSH-FE-003b: Approver の承認待ちカードが Grid レイアウトコンテナ（approver-action-cards）内に配置されること。
  it('DSH-FE-003b: Approver の承認待ちカードが Grid レイアウトコンテナ内に配置される', () => {
    renderDashboard('approver', mockDashboardApprover);

    // data-testid="approver-action-cards" の Grid コンテナが存在すること。
    const actionCardsContainer = screen.getByTestId('approver-action-cards');
    expect(actionCardsContainer).toBeInTheDocument();

    // コンテナ内に承認待ちラベルが存在すること（MyReportCountCards と同じ Grid 構造）。
    expect(within(actionCardsContainer).getByText('承認待ち')).toBeInTheDocument();
  });

  // DSH-FE-004b: Accounting の支払待ちカードが Grid レイアウトコンテナ（accounting-action-cards）内に配置されること。
  it('DSH-FE-004b: Accounting の支払待ちカードが Grid レイアウトコンテナ内に配置される', () => {
    renderDashboard('accounting', mockDashboardAccounting);

    // data-testid="accounting-action-cards" の Grid コンテナが存在すること。
    const actionCardsContainer = screen.getByTestId('accounting-action-cards');
    expect(actionCardsContainer).toBeInTheDocument();

    // コンテナ内に支払待ちラベルが存在すること（MyReportCountCards と同じ Grid 構造）。
    expect(within(actionCardsContainer).getByText('支払待ち')).toBeInTheDocument();
  });

  // DSH-FE-NEW-A1: Admin ロールで TenantStatusCards の 5 枚カードが data-testid="tenant-status-cards" 配下に描画されること（issue #164）。
  // jsdom は CSS レイアウト計算をしないため、DOM 構造（Grid ラップの存在・リンク枚数）を検証する。
  it('DSH-FE-NEW-A1: Admin ロールで TenantStatusCards の 5 枚カードが tenant-status-cards コンテナ内に描画される', () => {
    renderDashboard('admin', mockDashboardAdmin);

    // data-testid="tenant-status-cards" の Grid コンテナが存在すること。
    const tenantStatusCards = screen.getByTestId('tenant-status-cards');
    expect(tenantStatusCards).toBeInTheDocument();

    // コンテナ内に 5 枚分のリンク（各ステータスカードのリンク）が存在すること。
    const links = within(tenantStatusCards).getAllByRole('link');
    expect(links).toHaveLength(5);
  });

  // DSH-FE-NEW-A2: Admin ロールでメンバー数カードが data-testid="admin-member-count-cards" 配下の Grid コンテナ内に描画されること（issue #164）。
  // Grid コンテナでラップされて他ロール（MyReportCountCards）と同じ幅基準で配置されることを DOM 構造で検証する。
  it('DSH-FE-NEW-A2: Admin ロールでメンバー数カードが admin-member-count-cards Grid コンテナ内に配置される', () => {
    renderDashboard('admin', mockDashboardAdmin);

    // data-testid="admin-member-count-cards" の Grid コンテナが存在すること。
    const memberCountCards = screen.getByTestId('admin-member-count-cards');
    expect(memberCountCards).toBeInTheDocument();

    // コンテナ内に「メンバー数」ラベルが存在すること。
    expect(within(memberCountCards).getByText('メンバー数')).toBeInTheDocument();

    // コンテナ内に「人」単位テキストが存在すること。
    expect(within(memberCountCards).getByText('人')).toBeInTheDocument();
  });

  // DSH-FE-006: useDashboard が isLoading=true のとき PageSkeleton が表示されること。
  it('DSH-FE-006: isLoading=true のとき PageSkeleton が表示される', () => {
    (useCurrentUserModule.useCurrentUser as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    (useDashboardModule.useDashboard as Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    const Wrapper = createWrapper();
    render(<DashboardPage />, { wrapper: Wrapper });

    // PageSkeleton の CardSkeleton 内の Skeleton が描画されること。
    // PageSkeleton が表示されていれば、カウントカード等のコンテンツは表示されない。
    expect(screen.queryByText('下書き')).not.toBeInTheDocument();
    expect(screen.queryByText('年月')).not.toBeInTheDocument();
  });

  // DSH-FE-007: useDashboard が error を返すとき AppToast が severity="error" で表示されること。
  it('DSH-FE-007: error 発生時に AppToast が severity=error で表示される', () => {
    (useCurrentUserModule.useCurrentUser as Mock).mockReturnValue({
      data: { data: { role: 'member', name: 'Test', id: 'u1', email: 'e@e.com', tenant: { id: 't1', name: 'T' } } },
      isLoading: false,
      error: null,
    });
    const error = new ApiClientError('サーバーエラーが発生しました', 500, 'INTERNAL_ERROR');
    (useDashboardModule.useDashboard as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
    });
    const Wrapper = createWrapper();
    render(<DashboardPage />, { wrapper: Wrapper });

    // AppToast のエラーメッセージが表示されること。
    expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
  });

  // DSH-FE-039: location state にトースト情報が含まれている場合、AppToast が表示されること（issue 088）。
  // 認可エラー（403）でダッシュボードにリダイレクトされた際、navigate state 経由でトーストを受信する。
  it('DSH-FE-039: location state にトースト情報が含まれている場合 AppToast が表示される', async () => {
    const locationState = {
      toast: {
        severity: 'error',
        message: 'この画面にアクセスする権限がありません。',
      },
    };

    renderDashboardWithLocationState('member', mockDashboardMember, locationState);

    // AppToast のトーストメッセージが表示されること。
    await waitFor(() => {
      expect(screen.getByText('この画面にアクセスする権限がありません。')).toBeInTheDocument();
    });
  });
});
