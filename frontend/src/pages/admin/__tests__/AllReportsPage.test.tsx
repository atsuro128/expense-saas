// AllReportsPage のユニットテスト。
// TNT-FE-016〜023 に対応する。
// TNT-FE-024〜025: issue 088（403 認可エラーフィードバック）の navigate toast state 確認テストを追加。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, afterEach } from 'vitest';
import AllReportsPage from '../AllReportsPage';
import * as useAllReportsModule from '../../../hooks/useAllReports';
import * as useTenantMembersModule from '../../../hooks/useTenantMembers';
import * as useCurrentUserModule from '../../../hooks/useCurrentUser';
import { ApiClientError } from '../../../api/client';

// MUI X の ESM import 解決問題を回避するため、共通コンポーネントをモックする。
vi.mock('../../../components/ui/AppSelect', () => ({
  default: (props: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) => (
    <select aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} disabled={props.disabled}>
      {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));
vi.mock('../../../components/ui/AppDatePicker', () => ({
  default: (props: { label: string; value: string | null; onChange: (v: string | null) => void }) => (
    <input type="date" aria-label={props.label} value={props.value ?? ''} onChange={(e) => props.onChange(e.target.value || null)} />
  ),
}));
// AppDataGrid モック: GridRowParams 互換で { row: rowData } 形式で onRowClick を呼ぶ。
vi.mock('../../../components/ui/AppDataGrid', () => ({
  default: (props: {
    rows: unknown[];
    columns: unknown[];
    onRowClick?: (params: { row: unknown }) => void;
    loading?: boolean;
  }) => {
    if (props.loading) return <div data-testid="app-data-grid-loading">Loading...</div>;
    return (
      <table data-testid="app-data-grid">
        <tbody>
          {(props.rows as Array<{ id: string; title: string }>).map((row) => (
            <tr key={row.id} onClick={() => props.onRowClick?.({ row })} data-testid={`row-${row.id}`}>
              <td>{row.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));
vi.mock('../../../components/ui/StatusChip', () => ({
  default: (props: { status: string }) => <span data-testid="status-chip">{props.status}</span>,
}));
vi.mock('../../../components/ui/EmptyState', () => ({
  default: (props: { message: string }) => <div data-testid="empty-state">{props.message}</div>,
}));
vi.mock('../../../components/ui/PageSkeleton', () => ({
  default: (props: { variant: string }) => <div data-testid={`page-skeleton-${props.variant}`}>Loading...</div>,
}));

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

/** navigate で渡された state を検証するためのヘルパーコンポーネント。 */
function DashboardWithState() {
  const location = useLocation();
  const state = location.state as { toast?: { severity: string; message: string } } | null;
  return (
    <div>
      <div>Dashboard</div>
      {state?.toast && (
        <div data-testid="nav-toast-message">{state.toast.message}</div>
      )}
    </div>
  );
}

// テスト用ラッパー: QueryClientProvider + MemoryRouter + Routes。
function renderAllReportsPage(initialEntries: string[] = ['/reports/all']) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/reports/all" element={<AllReportsPage />} />
          <Route path="/" element={<DashboardWithState />} />
          <Route path="/reports/:id" element={<div data-testid="report-detail">Report Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// テスト用フィクスチャデータ。openapi.yaml ExpenseReportSummary に準拠した snake_case プロパティを使用する。
const mockReports = [
  {
    id: 'rpt-001',
    title: '出張費',
    submitter: { id: 'u1', name: 'User1' },
    total_amount: 10000,
    status: 'submitted' as const,
    submitted_at: '2025-01-15T00:00:00Z',
    created_at: '2025-01-10T00:00:00Z',
  },
  {
    id: 'rpt-002',
    title: '交通費',
    submitter: { id: 'u2', name: 'User2' },
    total_amount: 5000,
    status: 'approved' as const,
    submitted_at: '2025-01-20T00:00:00Z',
    created_at: '2025-01-15T00:00:00Z',
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
      data: { data: mockAdminUser },
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
      data: { data: mockAccountingUser },
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
      data: { data: { id: 'user2', name: 'Test Approver', email: 'approver@example.com', role: 'approver', tenant: { id: 'tenant1', name: 'Test Company A' } } },
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
      data: { data: { id: 'user3', name: 'Test Member', email: 'member@example.com', role: 'member', tenant: { id: 'tenant1', name: 'Test Company A' } } },
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
      data: { data: mockAdminUser },
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
      data: { data: mockAdminUser },
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
      data: { data: mockAdminUser },
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

    // ステータスセレクト（AppSelect モック = ネイティブ select）で「提出済み」を選択する。
    await user.selectOptions(screen.getByRole('combobox', { name: 'ステータス' }), 'submitted');

    // useAllReports が page=1 で呼び出されること（ページがリセットされること）。
    expect(mockUseAllReports).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  // TNT-FE-023: テーブル行クリック時にレポート詳細画面に遷移すること。
  // AppDataGrid（MUI DataGrid）の行クリックイベントを使用する。
  it('TNT-FE-023: テーブル行クリック時にレポート詳細画面（/reports/rpt-001）に遷移する', async () => {
    const user = userEvent.setup();

    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: mockAdminUser },
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

    // テーブルのタイトルセルが描画されること。
    await waitFor(() => {
      expect(screen.getByText('出張費')).toBeInTheDocument();
    });

    // DataGrid の行セル（タイトル列）をクリックして行クリックイベントを発火させる。
    await user.click(screen.getByText('出張費'));

    // レポート詳細画面に遷移すること。
    await waitFor(() => {
      expect(screen.getByTestId('report-detail')).toBeInTheDocument();
    });
  });

  // TNT-FE-024: ロール不一致時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示されること（issue 088）。
  it('TNT-FE-024: ロール不一致時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示される', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user3', name: 'Test Member', email: 'member@example.com', role: 'member', tenant: { id: 'tenant1', name: 'Test Company A' } } },
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

    // ダッシュボードにリダイレクトされること。
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // navigate の state にトーストメッセージが含まれること。
    await waitFor(() => {
      expect(screen.getByTestId('nav-toast-message')).toHaveTextContent('この画面にアクセスする権限がありません。');
    });
  });

  // TNT-FE-025: 403 エラー時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示されること（issue 088）。
  it('TNT-FE-025: 403 エラー時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示される', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: mockAdminUser },
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

    // ダッシュボードにリダイレクトされること。
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // navigate の state にトーストメッセージが含まれること。
    await waitFor(() => {
      expect(screen.getByTestId('nav-toast-message')).toHaveTextContent('この画面にアクセスする権限がありません。');
    });
  });
});
