// AllReportsPage のユニットテスト。
// TNT-FE-016〜023 に対応する。
// TNT-FE-046〜047: issue 088（403 認可エラーフィードバック）の navigate toast state 確認テストを追加。

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
  // value/onChange 型が string に統一されたことを反映する（null 不使用）。
  default: (props: { label: string; value: string; onChange: (v: string) => void }) => (
    <input type="date" aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
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

/** URL パスとクエリを検証するためのヘルパーコンポーネント（TNT-FE-048〜051 追加）。 */
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

// テスト用ラッパー: QueryClientProvider + MemoryRouter + Routes。
// 実アプリの / → /dashboard 2段遷移を再現するためルート構成を合わせる。
function renderAllReportsPage(initialEntries: string[] = ['/reports/all']) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/reports/all" element={<AllReportsPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardWithState />} />
          <Route path="/reports/:id" element={<div data-testid="report-detail">Report Detail</div>} />
        </Routes>
        <LocationDisplay />
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

  // TNT-FE-046: ロール不一致時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示されること（issue 088）。
  it('TNT-FE-046: ロール不一致時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示される', async () => {
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

  // TNT-FE-047: 403 エラー時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示されること（issue 088）。
  it('TNT-FE-047: 403 エラー時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示される', async () => {
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

  // =============================================================================
  // issue #147: AllReportsPage URL 駆動化 + per_page UI 結合テスト（TNT-FE-048〜051）
  // =============================================================================

  // TNT-FE-048: /reports/all?per_page=10 で開く
  // → テーブルに 10 件のみ描画される。フッターの PageSizeSelector が「10」を表示する。
  //    useAllReports への引数に per_page: 10 が渡り、API URL に ?per_page=10 が含まれる。
  it('TNT-FE-048: test_AllReportsPage_url_per_page_reflects_to_selector_and_api — URL の per_page=10 が PageSizeSelector と API 引数に反映される', async () => {
    // TNT-FE-048
    const reports10 = Array.from({ length: 10 }, (_, i) => ({
      id: `rpt-${String(i + 1).padStart(3, '0')}`,
      title: `レポート${i + 1}`,
      submitter: { id: 'u1', name: 'User1' },
      total_amount: (i + 1) * 1000,
      status: 'submitted' as const,
      submitted_at: '2025-01-15T00:00:00Z',
      created_at: '2025-01-10T00:00:00Z',
    }));

    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: mockAdminUser },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    const mockUseAllReports = vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: { data: reports10, pagination: { current_page: 1, per_page: 10, total_count: 30, total_pages: 3 } },
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

    // URL に per_page=10 を設定してページを開く。
    renderAllReportsPage(['/reports/all?per_page=10']);

    // useAllReports に per_page: 10 が渡されること（URL → Hook 反映）。
    await waitFor(() => {
      expect(mockUseAllReports).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 10 }),
      );
    });

    // フッターの PageSizeSelector が「10」を現在値として表示すること。
    // スタブ実装（AppPaginationFooter / PageSizeSelector 未存在）のため失敗するが
    // β2 テスト先行仕様で許容する。
    await waitFor(() => {
      const selector = screen.getByTestId('page-size-selector');
      expect(selector).toHaveTextContent('10');
    });
  });

  // TNT-FE-049: /reports/all?page=3&per_page=10 で開いた状態で PageSizeSelector から「50」を選択
  // → URL が /reports/all?page=1&per_page=50 に更新される（page=1 リセット）。
  //    setSearchParams は 1 回のコールに集約される（race 回避、重要リスク 5）。
  //    PageSizeSelector の現在値が「50」に更新される。
  it('TNT-FE-049: test_AllReportsPage_selector_change_updates_url_and_resets_page — per_page 変更時に page=1 リセット + setSearchParams 1 コール集約（重要リスク 5）', async () => {
    // TNT-FE-049
    const user = userEvent.setup();

    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: mockAdminUser },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    const mockUseAllReports = vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: { data: mockReports, pagination: { current_page: 3, per_page: 10, total_count: 30, total_pages: 3 } },
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

    // page=3, per_page=10 の状態でページを開く。
    renderAllReportsPage(['/reports/all?page=3&per_page=10']);

    // PageSizeSelector が描画されるまで待機する。
    // スタブ実装（AppPaginationFooter / PageSizeSelector 未存在）のため失敗するが β2 テスト先行仕様で許容する。
    const selector = await screen.findByTestId('page-size-selector');
    const combobox = within(selector).getByRole('combobox');
    await user.click(combobox);

    // 「50」の選択肢をクリックして per_page を変更する。
    const option50 = await screen.findByRole('option', { name: '50' });
    await user.click(option50);

    // useAllReports に per_page: 50, page: 1 が渡されること（page=1 リセット）。
    await waitFor(() => {
      expect(mockUseAllReports).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 50, page: 1 }),
      );
    });

    // setSearchParams が 1 コールで per_page と page を同時更新すること（race 回避）。
    // URL に page=1 と per_page=50 が反映されること。
    await waitFor(() => {
      const locationText = screen.getByTestId('location').textContent ?? '';
      expect(locationText).toContain('page=1');
      expect(locationText).toContain('per_page=50');
    });
  });

  // TNT-FE-050: /reports/all?page=2 で開く
  // → useAllReports への引数に page: 2 が渡る。
  //    （useState ではなく useSearchParams 経由で URL から読み取られていることを保証、issue #147 Q2）
  //    ページネーションコントロールで「3」をクリックすると URL が /reports/all?page=3 に更新される。
  it('TNT-FE-050: test_AllReportsPage_page_state_is_url_driven — page 状態が useSearchParams 経由で管理されている（URL 駆動化、issue #147 Q2）', async () => {
    // TNT-FE-050
    const user = userEvent.setup();

    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: mockAdminUser },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    const mockUseAllReports = vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
      data: { data: mockReports, pagination: { current_page: 2, per_page: 20, total_count: 60, total_pages: 3 } },
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

    // page=2 で開く。
    renderAllReportsPage(['/reports/all?page=2']);

    // useAllReports に page: 2 が渡されること（URL → Hook 反映、useState ではなく useSearchParams 経由）。
    await waitFor(() => {
      expect(mockUseAllReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });

    // ページネーションコントロールが存在すること。
    // スタブ実装（AppPaginationFooter 未存在）のため失敗するが β2 テスト先行仕様で許容する。
    const page3Button = await screen.findByRole('button', { name: /3/ });
    await user.click(page3Button);

    // URL が /reports/all?page=3 に更新されること（useState 由来の独立 state ではない保証）。
    await waitFor(() => {
      const locationText = screen.getByTestId('location').textContent ?? '';
      expect(locationText).toContain('page=3');
    });

    // useAllReports に page: 3 が渡されること。
    await waitFor(() => {
      expect(mockUseAllReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3 }),
      );
    });
  });

  // TNT-FE-051: /reports/all?per_page=abc（NaN）と /reports/all?per_page=-5（負数）の 2 サブケース
  // → 両サブケースとも useAllReports への引数 per_page が 20（FE フォールバック）になり、
  //    PageSizeSelector も「20」を表示する（issue #147 Q4、重要リスク 2）。
  it('TNT-FE-051: test_AllReportsPage_url_invalid_per_page_falls_back_to_20 — NaN/負数の per_page は 20 にフォールバックされる（重要リスク 2）', async () => {
    // TNT-FE-051

    // サブケース 1: per_page=abc（NaN）
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: mockAdminUser },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    const mockUseAllReportsSub1 = vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
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

    const { unmount } = renderAllReportsPage(['/reports/all?per_page=abc']);

    // useAllReports に per_page: 20（フォールバック）が渡されること。
    await waitFor(() => {
      expect(mockUseAllReportsSub1).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 20 }),
      );
    });

    // NaN の場合 per_page が NaN で呼ばれていないこと。
    const nanCalls = mockUseAllReportsSub1.mock.calls.filter(
      (args) => Number.isNaN(args[0]?.per_page),
    );
    expect(nanCalls).toHaveLength(0);

    unmount();
    vi.clearAllMocks();

    // サブケース 2: per_page=-5（負数）
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: mockAdminUser },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    const mockUseAllReportsSub2 = vi.spyOn(useAllReportsModule, 'useAllReports').mockReturnValue({
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

    renderAllReportsPage(['/reports/all?per_page=-5']);

    // useAllReports に per_page: 20（フォールバック）が渡されること。
    await waitFor(() => {
      expect(mockUseAllReportsSub2).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 20 }),
      );
    });

    // 負数の場合 per_page=-5 で呼ばれていないこと。
    const negativeCalls = mockUseAllReportsSub2.mock.calls.filter(
      (args) => (args[0]?.per_page ?? 0) < 0,
    );
    expect(negativeCalls).toHaveLength(0);
  });
});
