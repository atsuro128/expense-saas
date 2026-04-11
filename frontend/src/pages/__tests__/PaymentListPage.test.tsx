// PayableReportsPage（PaymentListPage）のユニットテスト。
// WFL-FE-030〜054 に対応する。
// SCR-WFL-002（支払待ち一覧）の画面コンポーネントをスタブ実装で検証する。
//
// Traceability: test_cases/workflow.md（WFL-FE-030〜WFL-FE-054）
// WFL-FE-030 → 'WFL-FE-030: renders_payable_reports_page_with_data'
// WFL-FE-031 → 'WFL-FE-031: manages_filter_state'
// WFL-FE-032 → 'WFL-FE-032: manages_pagination_state'
// WFL-FE-033 → 'WFL-FE-033: resets_page_on_filter_change'
// WFL-FE-034 → 'WFL-FE-034: redirects_non_accounting_on_403'
// WFL-FE-035 → 'WFL-FE-035: shows_skeleton_when_loading'
// WFL-FE-036 → 'WFL-FE-036: shows_empty_state_no_filter'
// WFL-FE-037 → 'WFL-FE-037: shows_empty_state_with_filter'
// WFL-FE-038 → 'WFL-FE-038: shows_table_with_data'
// WFL-FE-039 → 'WFL-FE-039: shows_toast_on_server_error'
// WFL-FE-040 → ページ統合テストで代替（PayableFilterBar デバウンス: WFL-FE-031 に包含）
// WFL-FE-041 → ページ統合テストで代替（PayableFilterBar リセット: WFL-FE-031/033 に包含）
// WFL-FE-042 → 'WFL-FE-042: displays_report_count'
// WFL-FE-043 → ページ統合テストで代替（PayableReportCount 非表示: WFL-FE-036 に包含）
// WFL-FE-044 → ページ統合テストで代替（PayableReportCount 条件なし: WFL-FE-037 に包含）
// WFL-FE-045 → 'WFL-FE-045: renders_table_columns'
// WFL-FE-046 → 'WFL-FE-046: shows_self_label_for_own_report'
// WFL-FE-047 → 'WFL-FE-047: hides_self_label_for_other_report'
// WFL-FE-048 → 'WFL-FE-048: navigates_to_detail_on_row_click'
// WFL-FE-049 → ページ統合テストで代替（PayableReportTable スケルトン: WFL-FE-035 に包含）
// WFL-FE-050 → ページ統合テストで代替（PayableReportTable 空状態: WFL-FE-036 に包含）
// WFL-FE-051 → 'WFL-FE-051: renders_approved_date_column'
// WFL-FE-052 → usePayableReports.test.tsx: 'WFL-FE-052: fetches_payable_reports_with_params'
// WFL-FE-053 → usePayableReports.test.tsx: 'WFL-FE-053: uses_correct_query_key'
// WFL-FE-054 → usePayableReports.test.tsx: 'WFL-FE-054: respects_stale_time'

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
    rows: Array<{ id: string; submitter_name: string; title: string; total_amount: number; is_own_report: boolean; approved_at: string | null }>;
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
      <table data-testid="payable-report-table">
        <tbody>
          {props.rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => props.onRowClick?.({ row })}
              data-testid={`payable-report-row-${row.id}`}
            >
              <td>
                {row.submitter_name}
                {row.is_own_report && <span>自分</span>}
              </td>
              <td>{row.title}</td>
              <td>{`¥${row.total_amount.toLocaleString()}`}</td>
              <td data-testid="payable-table-header-approved-at">
                {row.approved_at ? new Date(row.approved_at).toLocaleDateString('ja-JP') : '-'}
              </td>
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

import PaymentListPage from '../PaymentListPage';

// usePayableReports Hook をモックする。
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

import { usePayableReports } from '../../hooks/useReports';

const mockUsePayableReports = vi.mocked(usePayableReports);

// テスト用の PayableReport データ。
const mockPayableReports = [
  {
    id: 'report-001',
    title: '4月交通費',
    total_amount: 15000,
    approved_at: '2026-03-20T00:00:00Z',
    submitter: { id: 'user-003', name: '田中太郎' },
    is_own_report: false,
  },
  {
    id: 'report-002',
    title: '3月出張費',
    total_amount: 50000,
    approved_at: '2026-03-15T00:00:00Z',
    submitter: { id: 'user-003', name: '田中太郎' },
    is_own_report: false,
  },
  {
    id: 'report-003',
    title: '自分の承認済みレポート',
    total_amount: 8000,
    approved_at: '2026-03-10T00:00:00Z',
    submitter: { id: 'accounting-user-id', name: 'Test Accounting' },
    is_own_report: true,
  },
];

// ルーティングによる遷移先を検証するためのヘルパーコンポーネント。
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage(initialEntry = '/workflow/payable') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/workflow/payable" element={<PaymentListPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-page">dashboard</div>} />
          <Route path="/reports/:id" element={<div data-testid="detail-page">detail</div>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PaymentListPage（PayableReportsPage）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WFL-FE-030: usePayableReports が 3 件のレポートデータを返す
  // → PayableReportsContent にレポート一覧が表示される。
  it('WFL-FE-030: renders_payable_reports_page_with_data — 3件のデータが表示される', () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: mockPayableReports,
        pagination: { current_page: 1, per_page: 20, total_count: 3, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    expect(screen.getByTestId('payable-reports-page')).toBeInTheDocument();
  });

  // WFL-FE-031: 申請者名フィルタに「田中」と入力後 300ms 待機
  // → usePayableReports が { applicant_name: "田中", page: 1 } で呼び出される
  it('WFL-FE-031: manages_filter_state — フィルタ入力が usePayableReports に反映される', async () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: mockPayableReports,
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
    const filterInput = screen.getByTestId('payable-filter-applicant-name');
    await user.type(filterInput, '田中');

    // 300ms 経過後に usePayableReports が applicant_name 付きで呼ばれること。
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    await waitFor(() => {
      expect(mockUsePayableReports).toHaveBeenCalledWith(
        expect.objectContaining({ applicant_name: '田中', page: 1 }),
      );
    });
  });

  // WFL-FE-032: ページネーションで 2 ページ目をクリック
  // → usePayableReports が { page: 2 } で呼び出される
  it('WFL-FE-032: manages_pagination_state — ページネーションが usePayableReports に反映される', async () => {
    const user = userEvent.setup();
    mockUsePayableReports.mockReturnValue({
      data: {
        data: mockPayableReports,
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
      expect(mockUsePayableReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  // WFL-FE-033: 2 ページ目を表示中にフィルタを変更
  // → ページが 1 にリセットされ、usePayableReports が { page: 1 } で呼び出される
  it('WFL-FE-033: resets_page_on_filter_change — フィルタ変更時にページが 1 にリセットされる', async () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: mockPayableReports,
        pagination: { current_page: 2, per_page: 20, total_count: 3, total_pages: 2 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const user = userEvent.setup({ delay: null });
    renderPage('/workflow/payable?page=2');

    // 申請者名フィルタに入力する。
    const filterInput = screen.getByTestId('payable-filter-applicant-name');
    await user.type(filterInput, '田中');

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    // フィルタ変更後に page=1 で呼ばれること。
    await waitFor(() => {
      expect(mockUsePayableReports).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  // WFL-FE-034: usePayableReports が 403 エラーを返す
  // → ダッシュボード（SCR-DASH-001）にリダイレクトされる
  it('WFL-FE-034: redirects_non_accounting_on_403 — 403 エラー時にダッシュボードにリダイレクト', async () => {
    mockUsePayableReports.mockReturnValue({
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

  // WFL-FE-035: isLoading=true のとき PageSkeleton（variant: "table"）が表示される。
  it('WFL-FE-035: shows_skeleton_when_loading — isLoading=true のとき PageSkeleton が表示される', () => {
    mockUsePayableReports.mockReturnValue({
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

  // WFL-FE-036: reports=[], isLoading=false, filters={} のとき「支払待ちのレポートはありません。」が表示される。
  it('WFL-FE-036: shows_empty_state_no_filter — 空リストでフィルタなしの EmptyState', () => {
    mockUsePayableReports.mockReturnValue({
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
    expect(screen.getByText('支払待ちのレポートはありません。')).toBeInTheDocument();
  });

  // WFL-FE-037: reports=[], filters={ applicant_name: "存在しない名前" } のとき「条件に一致するレポートはありません。」とリセットボタンが表示される。
  it('WFL-FE-037: shows_empty_state_with_filter — フィルタありで条件に一致なしの EmptyState', () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: [],
        pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/workflow/payable?applicant_name=存在しない名前');

    // AppDataGrid モックが emptyMessage を描画すること。
    expect(screen.getByText('条件に一致するレポートはありません。')).toBeInTheDocument();
    // フィルタリセットボタンが表示されること。
    expect(screen.getByTestId('filter-reset-button')).toBeInTheDocument();
  });

  // WFL-FE-038: reports に 2 件のレポートデータがある場合、テーブルが表示され 2 行が描画される。
  it('WFL-FE-038: shows_table_with_data — 2件のデータがあるときテーブルが描画される', () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: mockPayableReports.slice(0, 2),
        pagination: { current_page: 1, per_page: 20, total_count: 2, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // AppDataGrid モックの table が描画されること。
    expect(screen.getByTestId('payable-report-table')).toBeInTheDocument();
  });

  // WFL-FE-039: error に 500 エラーオブジェクトがあるとき AppToast でサーバーエラーが表示される。
  it('WFL-FE-039: shows_toast_on_server_error — 500 エラー時に AppToast が表示される', async () => {
    mockUsePayableReports.mockReturnValue({
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

  // WFL-FE-042: totalCount=5, isFiltered=false のとき「5 件の支払待ちレポート」が表示される。
  it('WFL-FE-042: displays_report_count — 「5 件の支払待ちレポート」が表示される', () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: mockPayableReports,
        pagination: { current_page: 1, per_page: 20, total_count: 5, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // 「5 件の支払待ちレポート」が表示されること。
    expect(screen.getByText('5 件の支払待ちレポート')).toBeInTheDocument();
  });

  // WFL-FE-045: レポートテーブルに申請者名・タイトル・金額・承認日が描画される。
  it('WFL-FE-045: renders_table_columns — テーブルの各カラムが正しく描画される', () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: [mockPayableReports[0]],
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
  });

  // WFL-FE-046: is_own_report=true のレポートに「自分」ラベルが表示される。
  it('WFL-FE-046: shows_self_label_for_own_report — is_own_report=true のとき「自分」ラベルが表示される', () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: [mockPayableReports[2]], // is_own_report: true のレポート
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

  // WFL-FE-047: is_own_report=false のレポートに「自分」ラベルが表示されない。
  it('WFL-FE-047: hides_self_label_for_other_report — is_own_report=false のとき「自分」ラベルが表示されない', () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: [mockPayableReports[0]], // is_own_report: false のレポート
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

  // WFL-FE-048: レポート行をクリックすると /reports/{id} に遷移する。
  it('WFL-FE-048: navigates_to_detail_on_row_click — レポート行クリックで詳細ページに遷移する', async () => {
    const user = userEvent.setup();
    mockUsePayableReports.mockReturnValue({
      data: {
        data: [mockPayableReports[0]],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // AppDataGrid モックの行をクリックする。
    const row = screen.getByTestId('payable-report-row-report-001');
    await user.click(row);

    // /reports/report-001 に遷移すること。
    await waitFor(() => {
      const location = screen.getByTestId('location').textContent ?? '';
      expect(location).toContain('/reports/report-001');
    });
  });

  // WFL-FE-051: 日付カラムが「承認日」であること（SCR-WFL-001 の「提出日」との差異）。
  it('WFL-FE-051: renders_approved_date_column — 日付カラムが「承認日」であること', () => {
    mockUsePayableReports.mockReturnValue({
      data: {
        data: [mockPayableReports[0]],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // AppDataGrid モックで payable-table-header-approved-at が描画されること。
    expect(screen.getByTestId('payable-table-header-approved-at')).toBeInTheDocument();
  });
});
