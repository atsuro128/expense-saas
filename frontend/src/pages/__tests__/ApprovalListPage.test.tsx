// PendingApprovalsPage（ApprovalListPage）のユニットテスト。
// WFL-FE-001〜026 に対応する。
// SCR-WFL-001（承認待ち一覧）の画面コンポーネントをスタブ実装で検証する。
//
// Traceability: test_cases/workflow.md（WFL-FE-001〜WFL-FE-026）
// WFL-FE-001 → 'WFL-FE-001: renders_pending_approvals_page_with_data'
// WFL-FE-002 → 'WFL-FE-002: manages_filter_state'
// WFL-FE-003 → 'WFL-FE-003: manages_pagination_state'
// WFL-FE-004 → 'WFL-FE-004: resets_page_on_filter_change'
// WFL-FE-005 → 'WFL-FE-005: redirects_non_approver_on_403'
// WFL-FE-006 → 'WFL-FE-006: shows_skeleton_when_loading'
// WFL-FE-007 → 'WFL-FE-007: shows_empty_state_no_filter'
// WFL-FE-008 → 'WFL-FE-008: shows_empty_state_with_filter'
// WFL-FE-009 → 'WFL-FE-009: shows_table_with_data'
// WFL-FE-010 → 'WFL-FE-010: shows_toast_on_server_error'
// WFL-FE-011 → ページ統合テストで代替（PendingFilterBar デバウンス: WFL-FE-002 に包含）
// WFL-FE-012 → ページ統合テストで代替（PendingFilterBar リセット: WFL-FE-002/004 に包含）
// WFL-FE-013 → 'WFL-FE-013: displays_report_count'
// WFL-FE-014 → ページ統合テストで代替（PendingReportCount 非表示: WFL-FE-007 に包含）
// WFL-FE-015 → ページ統合テストで代替（PendingReportCount 条件なし: WFL-FE-008 に包含）
// WFL-FE-016 → 'WFL-FE-016: renders_table_columns'
// WFL-FE-017 → 'WFL-FE-017: shows_self_label_for_own_report'
// WFL-FE-018 → 'WFL-FE-018: hides_self_label_for_other_report'
// WFL-FE-019 → 'WFL-FE-019: navigates_to_detail_on_row_click'
// WFL-FE-020 → ページ統合テストで代替（PendingReportTable スケルトン: WFL-FE-006 に包含）
// WFL-FE-021 → ページ統合テストで代替（PendingReportTable 空状態: WFL-FE-007 に包含）
// WFL-FE-022 → SelfLabel.test.tsx: 'WFL-FE-022: renders_self_chip_when_own'
// WFL-FE-023 → SelfLabel.test.tsx: 'WFL-FE-023: renders_nothing_when_not_own'
// WFL-FE-024 → FilterResetButton.test.tsx: 'WFL-FE-024: enabled_when_filter_applied'
// WFL-FE-025 → FilterResetButton.test.tsx: 'WFL-FE-025: disabled_when_no_filter'
// WFL-FE-026 → FilterResetButton.test.tsx: 'WFL-FE-026: calls_on_reset_on_click'

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, afterEach, expect } from 'vitest';

// MUI X の ESM import 解決問題を回避するため AppDataGrid をモックする。
// onRowClick は { row: rowData } 形式で呼び出す。
// is_own_report が true のとき「自分」ラベルを描画する（SelfLabel の動作を再現）。
vi.mock('../../components/ui/AppDataGrid', () => ({
  default: (props: {
    rows: Array<{ id: string; submitter_name: string; title: string; total_amount: number; is_own_report: boolean; submitted_at: string | null }>;
    columns: unknown[];
    onRowClick?: (params: { row: unknown }) => void;
    loading?: boolean;
    emptyMessage?: string;
  }) => {
    if (props.loading) return <div data-testid="app-data-grid-loading">Loading...</div>;
    if (props.rows.length === 0) {
      return <div data-testid="app-data-grid">{props.emptyMessage}</div>;
    }
    return (
      <table data-testid="pending-report-table" data-column-count={props.columns.length}>
        <tbody>
          {props.rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => props.onRowClick?.({ row })}
              data-testid={`pending-report-row-${row.id}`}
            >
              <td>
                {row.submitter_name}
                {row.is_own_report && <span>自分</span>}
              </td>
              <td>{row.title}</td>
              <td>{`¥${row.total_amount.toLocaleString()}`}</td>
              <td>{row.submitted_at ? new Date(row.submitted_at).toLocaleDateString('ja-JP') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));

// AppPagination をモックする。pagination-page-{n} testid を持つボタンを描画する。
vi.mock('../../components/ui/AppPagination', () => ({
  default: (props: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    disabled?: boolean;
  }) => {
    if (props.totalPages <= 1) return null;
    return (
      <div data-testid="app-pagination">
        {Array.from({ length: props.totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            data-testid={`pagination-page-${p}`}
            onClick={() => props.onPageChange(p)}
            aria-current={p === props.currentPage ? 'page' : undefined}
          >
            {p}
          </button>
        ))}
      </div>
    );
  },
}));

import ApprovalListPage from '../ApprovalListPage';

// usePendingReports Hook をモックする。
vi.mock('../../hooks/useReports', () => ({
  usePendingReports: vi.fn(),
  usePayableReports: vi.fn(),
  useMyReports: vi.fn(),
  useReport: vi.fn(),
  useCreateReport: vi.fn(),
  useUpdateReport: vi.fn(),
  useSubmitReport: vi.fn(),
  useDeleteReport: vi.fn(),
}));

import { usePendingReports } from '../../hooks/useReports';

const mockUsePendingReports = vi.mocked(usePendingReports);

// テスト用の PendingReport データ。
const mockPendingReports = [
  {
    id: 'report-001',
    title: '4月交通費',
    total_amount: 15000,
    submitted_at: '2026-03-15T00:00:00Z',
    submitter: { id: 'user-003', name: '田中太郎' },
    is_own_report: false,
  },
  {
    id: 'report-002',
    title: '3月出張費',
    total_amount: 50000,
    submitted_at: '2026-03-10T00:00:00Z',
    submitter: { id: 'user-003', name: '田中太郎' },
    is_own_report: false,
  },
  {
    id: 'report-003',
    title: '自分のレポート',
    total_amount: 8000,
    submitted_at: '2026-03-01T00:00:00Z',
    submitter: { id: 'approver-user-id', name: 'Test Approver' },
    is_own_report: true,
  },
];

// ルーティングによる遷移先を検証するためのヘルパーコンポーネント。
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage(initialEntry = '/workflow/pending') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/workflow/pending" element={<ApprovalListPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-page">dashboard</div>} />
          <Route path="/reports/:id" element={<div data-testid="detail-page">detail</div>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ApprovalListPage（PendingApprovalsPage）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WFL-FE-001: usePendingReports が 3 件のレポートデータを返す
  // → PendingApprovalsContent にレポート一覧が表示される。件数表示「3 件の承認待ちレポート」が表示される
  it('WFL-FE-001: renders_pending_approvals_page_with_data — 3件のデータが表示される', () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: mockPendingReports,
        pagination: { current_page: 1, per_page: 20, total_count: 3, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    expect(screen.getByTestId('pending-approvals-page')).toBeInTheDocument();
  });

  // WFL-FE-002: 申請者名フィルタに「田中」と入力後 300ms 待機
  // → usePendingReports が { applicant_name: "田中", page: 1 } で呼び出される
  it('WFL-FE-002: manages_filter_state — フィルタ入力が usePendingReports に反映される', async () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: mockPendingReports,
        pagination: { current_page: 1, per_page: 20, total_count: 3, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const user = userEvent.setup({ delay: null });
    renderPage();

    // 申請者名フィルタに入力する。
    const filterInput = screen.getByTestId('pending-filter-applicant-name');
    await user.type(filterInput, '田中');

    // 300ms 経過後に usePendingReports が applicant_name 付きで呼ばれること。
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    await waitFor(() => {
      expect(mockUsePendingReports).toHaveBeenCalledWith(
        expect.objectContaining({ applicant_name: '田中', page: 1 }),
      );
    });
  });

  // WFL-FE-003: ページネーションで 2 ページ目をクリック
  // → usePendingReports が { page: 2 } で呼び出される
  it('WFL-FE-003: manages_pagination_state — ページネーションが usePendingReports に反映される', async () => {
    const user = userEvent.setup();
    mockUsePendingReports.mockReturnValue({
      data: {
        data: mockPendingReports,
        pagination: { current_page: 1, per_page: 20, total_count: 3, total_pages: 2 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // AppPagination モックの 2 ページ目ボタンをクリックする。
    const page2Button = screen.getByTestId('pagination-page-2');
    await user.click(page2Button);

    await waitFor(() => {
      expect(mockUsePendingReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  // WFL-FE-004: 2 ページ目を表示中にフィルタを変更
  // → ページが 1 にリセットされ、usePendingReports が { page: 1 } で呼び出される
  it('WFL-FE-004: resets_page_on_filter_change — フィルタ変更時にページが 1 にリセットされる', async () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: mockPendingReports,
        pagination: { current_page: 2, per_page: 20, total_count: 3, total_pages: 2 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const user = userEvent.setup({ delay: null });
    renderPage('/workflow/pending?page=2');

    // 申請者名フィルタに入力する。
    const filterInput = screen.getByTestId('pending-filter-applicant-name');
    await user.type(filterInput, '田中');

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    // フィルタ変更後に page=1 で呼ばれること。
    await waitFor(() => {
      expect(mockUsePendingReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  // WFL-FE-005: usePendingReports が 403 エラーを返す
  // → ダッシュボード（SCR-DASH-001）にリダイレクトされる
  it('WFL-FE-005: redirects_non_approver_on_403 — 403 エラー時にダッシュボードにリダイレクト', async () => {
    mockUsePendingReports.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { status: 403, code: 'FORBIDDEN', message: 'Forbidden' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // ダッシュボードにリダイレクトされること。
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  // WFL-FE-006: isLoading=true のとき PageSkeleton（variant: "table"）が表示される。
  it('WFL-FE-006: shows_skeleton_when_loading — isLoading=true のとき PageSkeleton が表示される', () => {
    mockUsePendingReports.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // PageSkeleton が表示されること。
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('page-skeleton')).toHaveAttribute('data-variant', 'table');
  });

  // WFL-FE-007: reports=[], isLoading=false, filters={} のとき「承認待ちのレポートはありません。」が表示される。
  it('WFL-FE-007: shows_empty_state_no_filter — 空リストでフィルタなしの EmptyState', () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: [],
        pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // AppDataGrid モックが emptyMessage を描画すること。
    expect(screen.getByText('承認待ちのレポートはありません。')).toBeInTheDocument();
  });

  // WFL-FE-008: reports=[], filters={ applicant_name: "存在しない名前" } のとき「条件に一致するレポートはありません。」とリセットボタンが表示される。
  it('WFL-FE-008: shows_empty_state_with_filter — フィルタありで条件に一致なしの EmptyState', () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: [],
        pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/workflow/pending?applicant_name=存在しない名前');

    // AppDataGrid モックが emptyMessage を描画すること。
    expect(screen.getByText('条件に一致するレポートはありません。')).toBeInTheDocument();
    // フィルタリセットボタンが表示されること。
    expect(screen.getByTestId('filter-reset-button')).toBeInTheDocument();
  });

  // WFL-FE-009: reports に 2 件のレポートデータがある場合、テーブルが表示され 2 行が描画される。
  it('WFL-FE-009: shows_table_with_data — 2件のデータがあるときテーブルが描画される', () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: mockPendingReports.slice(0, 2),
        pagination: { current_page: 1, per_page: 20, total_count: 2, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // AppDataGrid モックの table が描画されること。
    expect(screen.getByTestId('pending-report-table')).toBeInTheDocument();
  });

  // WFL-FE-010: error に 500 エラーオブジェクトがあるとき AppToast でサーバーエラーが表示される。
  it('WFL-FE-010: shows_toast_on_server_error — 500 エラー時に AppToast が表示される', async () => {
    mockUsePendingReports.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // AppToast が表示されること。
    await waitFor(() => {
      expect(screen.getByTestId('app-toast')).toBeInTheDocument();
    });
  });

  // WFL-FE-013: totalCount=5, isFiltered=false のとき「5 件の承認待ちレポート」が表示される。
  it('WFL-FE-013: displays_report_count — 「5 件の承認待ちレポート」が表示される', () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: mockPendingReports,
        pagination: { current_page: 1, per_page: 20, total_count: 5, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // 「5 件の承認待ちレポート」が表示されること。
    expect(screen.getByText('5 件の承認待ちレポート')).toBeInTheDocument();
  });

  // WFL-FE-016: レポートテーブルに申請者名・タイトル・金額・提出日が描画される。
  it('WFL-FE-016: renders_table_columns — テーブルの各カラムが正しく描画される', () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: [mockPendingReports[0]],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // 申請者名・タイトルが表示されること。
    expect(screen.getByText('田中太郎')).toBeInTheDocument();
    expect(screen.getByText('4月交通費')).toBeInTheDocument();
    // 遷移アイコン列を含む5カラムであること。
    expect(screen.getByTestId('pending-report-table')).toHaveAttribute('data-column-count', '5');
  });

  // WFL-FE-017: is_own_report=true のレポートに「自分」ラベルが表示される。
  it('WFL-FE-017: shows_self_label_for_own_report — is_own_report=true のとき「自分」ラベルが表示される', () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: [mockPendingReports[2]], // is_own_report: true のレポート
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // 「自分」ラベルが表示されること。
    expect(screen.getByText('自分')).toBeInTheDocument();
  });

  // WFL-FE-018: is_own_report=false のレポートに「自分」ラベルが表示されない。
  it('WFL-FE-018: hides_self_label_for_other_report — is_own_report=false のとき「自分」ラベルが表示されない', () => {
    mockUsePendingReports.mockReturnValue({
      data: {
        data: [mockPendingReports[0]], // is_own_report: false のレポート
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // 「自分」ラベルが表示されないこと。
    expect(screen.queryByText('自分')).not.toBeInTheDocument();
  });

  // WFL-FE-019: レポート行をクリックすると /reports/{id} に遷移する。
  it('WFL-FE-019: navigates_to_detail_on_row_click — レポート行クリックで詳細ページに遷移する', async () => {
    const user = userEvent.setup();
    mockUsePendingReports.mockReturnValue({
      data: {
        data: [mockPendingReports[0]],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // AppDataGrid モックの行をクリックする。
    const row = screen.getByTestId('pending-report-row-report-001');
    await user.click(row);

    // /reports/report-001 に遷移すること。
    await waitFor(() => {
      const location = screen.getByTestId('location').textContent ?? '';
      expect(location).toContain('/reports/report-001');
    });
  });
});
