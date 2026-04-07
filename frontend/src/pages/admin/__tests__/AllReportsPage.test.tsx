// AllReportsPage のユニットテスト。
// TNT-FE-016〜023 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, afterEach } from 'vitest';
import AllReportsPage from '../AllReportsPage';
import * as useAllReportsModule from '../../../hooks/useAllReports';
import * as useTenantMembersModule from '../../../hooks/useTenantMembers';
import * as useCurrentUserModule from '../../../hooks/useCurrentUser';
import { ApiClientError } from '../../../api/client';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

// テスト用ラッパー: QueryClientProvider + MemoryRouter + Routes。
function renderAllReportsPage(initialEntries: string[] = ['/reports/all']) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/reports/all" element={<AllReportsPage />} />
          <Route path="/" element={<div>Dashboard</div>} />
          <Route path="/reports/:id" element={<div data-testid="report-detail">Report Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// テスト用フィクスチャデータ。
const mockReports = [
  {
    id: 'rpt-001',
    title: '出張費',
    submitter: { id: 'u1', name: 'User1' },
    totalAmount: 10000,
    status: 'submitted' as const,
    submittedAt: '2025-01-15T00:00:00Z',
    createdAt: '2025-01-10T00:00:00Z',
  },
  {
    id: 'rpt-002',
    title: '交通費',
    submitter: { id: 'u2', name: 'User2' },
    totalAmount: 5000,
    status: 'approved' as const,
    submittedAt: '2025-01-20T00:00:00Z',
    createdAt: '2025-01-15T00:00:00Z',
  },
];

const mockMembers = [
  { id: 'u1', name: 'User1' },
  { id: 'u2', name: 'User2' },
  { id: 'u3', name: 'User3' },
  { id: 'u4', name: 'User4' },
];

const mockAdminUser = {
  id: 'user1',
  name: 'Test Admin',
  email: 'admin@example.com',
  role: 'admin' as const,
  tenant: { id: 'tenant1', name: 'Test Company A' },
};

const mockAccountingUser = {
  id: 'user4',
  name: 'Test Accounting',
  email: 'accounting@example.com',
  role: 'accounting' as const,
  tenant: { id: 'tenant1', name: 'Test Company A' },
};

describe('AllReportsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TNT-FE-016: Admin でレポート2件が表示されること。
  it('TNT-FE-016: Admin でレポート一覧が描画される', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: mockAdminUser,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: { data: mockReports, pagination: { current_page: 1, per_page: 20, total_count: 2, total_pages: 1 } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAllReportsModule.useAllReports>);

    vi.spyOn(useTenantMembersModule, 'useTenantMembers').mockReturnValue({
      data: { data: mockMembers },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantMembersModule.useTenantMembers>);

    renderAllReportsPage();

    // AllReportsFilterBar と AllReportsTable が描画されること。
    await waitFor(() => {
      expect(screen.getByTestId('all-reports-filter-bar')).toBeInTheDocument();
    });

    // レポート2件がテーブルに表示されること。
    expect(screen.getByText('出張費')).toBeInTheDocument();
    expect(screen.getByText('交通費')).toBeInTheDocument();
  });

  // TNT-FE-017: Accounting でレポート一覧が描画されること。
  it('TNT-FE-017: Accounting でレポート一覧が描画される（Admin と同一の画面構成）', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: mockAccountingUser,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: { data: mockReports, pagination: { current_page: 1, per_page: 20, total_count: 2, total_pages: 1 } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAllReportsModule.useAllReports>);

    vi.spyOn(useTenantMembersModule, 'useTenantMembers').mockReturnValue({
      data: { data: mockMembers },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantMembersModule.useTenantMembers>);

    renderAllReportsPage();

    // AllReportsFilterBar と AllReportsTable が描画されること（Admin と同一）。
    await waitFor(() => {
      expect(screen.getByTestId('all-reports-filter-bar')).toBeInTheDocument();
    });

    expect(screen.getByText('出張費')).toBeInTheDocument();
  });

  // TNT-FE-018: Approver ロールはダッシュボードにリダイレクトされること。
  it('TNT-FE-018: Approver ロールはダッシュボードにリダイレクトされる', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { id: 'user2', name: 'Test Approver', email: 'approver@example.com', role: 'approver', tenant: { id: 'tenant1', name: 'Test Company A' } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAllReportsModule.useAllReports>);

    vi.spyOn(useTenantMembersModule, 'useTenantMembers').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantMembersModule.useTenantMembers>);

    renderAllReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  // TNT-FE-019: Member ロールはダッシュボードにリダイレクトされること。
  it('TNT-FE-019: Member ロールはダッシュボードにリダイレクトされる', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { id: 'user3', name: 'Test Member', email: 'member@example.com', role: 'member', tenant: { id: 'tenant1', name: 'Test Company A' } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAllReportsModule.useAllReports>);

    vi.spyOn(useTenantMembersModule, 'useTenantMembers').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantMembersModule.useTenantMembers>);

    renderAllReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  // TNT-FE-020: 403 エラー時はダッシュボードにリダイレクトされること。
  it('TNT-FE-020: 403 エラー時はダッシュボードにリダイレクトされる', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: mockAdminUser,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError('Forbidden', 403, 'FORBIDDEN'),
    } as unknown as ReturnType<typeof useAllReportsModule.useAllReports>);

    vi.spyOn(useTenantMembersModule, 'useTenantMembers').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantMembersModule.useTenantMembers>);

    renderAllReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  // TNT-FE-021: 500 エラー時は SnackbarContext にエラーメッセージが通知されること。
  it('TNT-FE-021: 500 エラー時は AppToast にエラーメッセージが通知される', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: mockAdminUser,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError('Internal Server Error', 500, 'INTERNAL_ERROR'),
    } as unknown as ReturnType<typeof useAllReportsModule.useAllReports>);

    vi.spyOn(useTenantMembersModule, 'useTenantMembers').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantMembersModule.useTenantMembers>);

    renderAllReportsPage();

    await waitFor(() => {
      expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
    });
  });

  // TNT-FE-022: フィルタ変更時にページ番号が 1 にリセットされること。
  it('TNT-FE-022: フィルタ変更時にページ番号が 1 にリセットされる', async () => {
    const user = userEvent.setup();

    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: mockAdminUser,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    const mockUseAllReports = vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: { data: mockReports, pagination: { current_page: 1, per_page: 20, total_count: 2, total_pages: 1 } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAllReportsModule.useAllReports>);

    vi.spyOn(useTenantMembersModule, 'useTenantMembers').mockReturnValue({
      data: { data: mockMembers },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantMembersModule.useTenantMembers>);

    renderAllReportsPage();

    await waitFor(() => {
      expect(screen.getByTestId('all-reports-filter-bar')).toBeInTheDocument();
    });

    // ステータスセレクトで「提出済み」を選択するとフィルタが変更される。
    const statusSelect = screen.getByRole('combobox', { name: 'ステータス' });
    await user.selectOptions(statusSelect, 'submitted');

    // useAllReports が page=1 で呼び出されること（ページがリセットされること）。
    expect(mockUseAllReports).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  // TNT-FE-023: テーブル行クリック時にレポート詳細画面に遷移すること。
  it('TNT-FE-023: テーブル行クリック時にレポート詳細画面（/reports/rpt-001）に遷移する', async () => {
    const user = userEvent.setup();

    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: mockAdminUser,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: {
        data: [mockReports[0]],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAllReportsModule.useAllReports>);

    vi.spyOn(useTenantMembersModule, 'useTenantMembers').mockReturnValue({
      data: { data: mockMembers },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantMembersModule.useTenantMembers>);

    renderAllReportsPage();

    // テーブル行が描画されること。
    await waitFor(() => {
      expect(screen.getByTestId('report-row-rpt-001')).toBeInTheDocument();
    });

    // 行をクリックする。
    await user.click(screen.getByTestId('report-row-rpt-001'));

    // レポート詳細画面に遷移すること。
    await waitFor(() => {
      expect(screen.getByTestId('report-detail')).toBeInTheDocument();
    });
  });
});
