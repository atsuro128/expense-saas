// ProcessedReportsPage のユニットテスト。
// SCR-WFL-003（処理済みレポート一覧）の画面コンポーネントをスタブ実装で検証する。
// issue #158 チケット FE テスト方針に準拠する。
//
// テスト ID 体系: WFL-FE-061〜067（処理済みレポート一覧専用）

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';

// MUI X の ESM import 解決問題を回避するため AppDataGrid をモックする。
// onRowClick は { row: rowData } 形式で呼び出す。
// decision / current_status を含む行を描画する。
// slots.footer を受け取り DataGrid フッターコンテナ相当の div 内で描画する（issue #147 再オープン D-1 直接利用パターン検証用）。
vi.mock('../../../components/ui/AppDataGrid', () => ({
  default: (props: {
    rows: Array<{
      id: string;
      submitter_name: string;
      title: string;
      total_amount: number;
      decision: 'approved' | 'rejected';
      decided_at: string | null;
      current_status: 'approved' | 'rejected' | 'paid';
    }>;
    columns: unknown[];
    onRowClick?: (params: { row: unknown }) => void;
    loading?: boolean;
    emptyMessage?: string;
    slots?: { footer?: () => React.ReactNode };
  }) => {
    if (props.loading) return <div data-testid="app-data-grid-loading">Loading...</div>;
    if (props.rows.length === 0) {
      return (
        <div>
          <div data-testid="app-data-grid">{props.emptyMessage}</div>
          {/* DataGrid フッターコンテナ相当: slots.footer をここで描画する（issue #147 再オープン D-1 テスト用） */}
          {props.slots?.footer && (
            <div className="MuiDataGrid-footerContainer" data-testid="datagrid-footer-container">
              {props.slots.footer()}
            </div>
          )}
        </div>
      );
    }
    return (
      <div>
        <table data-testid="processed-report-table" data-column-count={props.columns.length}>
          <tbody>
            {props.rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => props.onRowClick?.({ row })}
                data-testid={`processed-report-row-${row.id}`}
              >
                <td>{row.submitter_name}</td>
                <td>{row.title}</td>
                <td>{`¥${row.total_amount.toLocaleString()}`}</td>
                {/* 処理結果バッジ: decision に応じて data-testid を付与して検証可能にする */}
                <td data-testid={`decision-cell-${row.id}`} data-decision={row.decision}>
                  {row.decision === 'approved' ? '承認' : '却下'}
                </td>
                {/* 現在ステータスバッジ */}
                <td data-testid={`status-cell-${row.id}`} data-status={row.current_status}>
                  {row.current_status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* DataGrid フッターコンテナ相当: slots.footer をここで描画する（issue #147 再オープン D-1 テスト用） */}
        {props.slots?.footer && (
          <div className="MuiDataGrid-footerContainer" data-testid="datagrid-footer-container">
            {props.slots.footer()}
          </div>
        )}
      </div>
    );
  },
}));

// AppPaginationFooter をモックする（page-size-selector testid で per_page セレクタを検証）。
vi.mock('../../../components/ui/AppPaginationFooter', () => ({
  default: (props: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    perPage: number;
    onPerPageChange: (size: number) => void;
    disabled?: boolean;
    totalCount?: number;
  }) => {
    const sizes = [10, 20, 50, 100];
    return (
      <div data-testid="app-pagination-footer">
        <span data-testid="pagination-current-page">{props.currentPage}</span>
        <span data-testid="pagination-total-pages">{props.totalPages}</span>
        {/* ページネーションボタン（2ページ以上のとき表示） */}
        {props.totalPages > 1 && (
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
        )}
        {/* per_page セレクタ（PageSizeSelector 相当） */}
        <div data-testid="page-size-selector">
          <select
            data-testid="page-size-select"
            value={props.perPage}
            onChange={(e) => props.onPerPageChange(Number(e.target.value))}
          >
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s} 件
              </option>
            ))}
          </select>
        </div>
        {props.totalCount !== undefined && (
          <span data-testid="pagination-total-count">{props.totalCount}</span>
        )}
      </div>
    );
  },
}));

import ProcessedReportsPage, { PAGE_TEST_ID as PROCESSED_PAGE_TEST_ID } from '../ProcessedReportsPage';

// useProcessedReports Hook をモックする。
vi.mock('../../../hooks/useReports', () => ({
  useProcessedReports: vi.fn(),
  usePendingReports: vi.fn(),
  usePayableReports: vi.fn(),
  useMyReports: vi.fn(),
  useReport: vi.fn(),
  useCreateReport: vi.fn(),
  useUpdateReport: vi.fn(),
  useSubmitReport: vi.fn(),
  useDeleteReport: vi.fn(),
}));

// useCurrentUser Hook をモックする（同期ロールチェック用）。
vi.mock('../../../hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

import { useProcessedReports } from '../../../hooks/useReports';
import * as useCurrentUserModule from '../../../hooks/useCurrentUser';

const mockUseProcessedReports = vi.mocked(useProcessedReports);

/** useCurrentUser を指定ロールでスタブする。 */
function mockCurrentUserWithRole(role: 'admin' | 'approver' | 'member' | 'accounting') {
  vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
    data: {
      data: {
        id: 'user-approver-001',
        name: 'テスト承認者',
        email: 'approver@example.com',
        role,
        tenant: { id: 'tenant-001', name: 'テスト会社' },
      },
    },
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);
}

// テスト用の ProcessedReport データ。
const mockProcessedReports = [
  {
    id: 'report-approved-001',
    title: '2026年3月 営業経費',
    total_amount: 12500,
    submitter: { id: 'user-003', name: '一般 次郎' },
    decision: 'approved' as const,
    decided_at: '2026-03-20T09:15:00Z',
    current_status: 'paid' as const,
  },
  {
    id: 'report-rejected-001',
    title: '2026年2月 出張費',
    total_amount: 45000,
    submitter: { id: 'user-004', name: '申請 花子' },
    decision: 'rejected' as const,
    decided_at: '2026-03-15T14:30:00Z',
    current_status: 'rejected' as const,
  },
];

// ルーティングによる遷移先を検証するためのヘルパーコンポーネント。
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

/**
 * navigate で渡された state を検証するためのヘルパーコンポーネント。
 * リダイレクト後のダッシュボードに toast が表示されることを検証する。
 */
function DashboardWithState() {
  const location = useLocation();
  const state = location.state as { toast?: { severity: string; message: string } } | null;
  return (
    <div>
      <div data-testid="dashboard-page">dashboard</div>
      {state?.toast && (
        <div data-testid="nav-toast-message">{state.toast.message}</div>
      )}
    </div>
  );
}

// ページをレンダリングするヘルパー関数。
function renderPage(initialEntry = '/approvals/processed') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/approvals/processed" element={<ProcessedReportsPage />} />
          <Route path="/dashboard" element={<DashboardWithState />} />
          <Route path="/reports/:id" element={<div data-testid="detail-page">detail</div>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProcessedReportsPage（処理済みレポート一覧）', () => {
  beforeEach(() => {
    // デフォルトは Approver ロール。個別テストで上書き可能。
    mockCurrentUserWithRole('approver');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WFL-FE-061: Approver ロールで 2 件のデータがある場合、テーブルが 6 カラムで描画される。
  it('WFL-FE-061: renders_processed_reports_page_with_6_columns — 6 カラムのテーブルが表示される', () => {
    mockUseProcessedReports.mockReturnValue({
      data: {
        data: mockProcessedReports,
        pagination: { current_page: 1, per_page: 20, total_count: 2, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // ページが描画されること。
    expect(screen.getByTestId('processed-reports-page')).toBeInTheDocument();
    // テーブルが 6 カラムであること（申請者名/タイトル/合計金額/処理結果/処理日/現在ステータス）。
    expect(screen.getByTestId('processed-report-table')).toHaveAttribute('data-column-count', '6');
  });

  // WFL-FE-062: データが 0 件のとき「処理済みのレポートはありません。」が表示される。
  it('WFL-FE-062: shows_empty_state — 「処理済みのレポートはありません。」が表示される', () => {
    mockUseProcessedReports.mockReturnValue({
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

    // 空状態メッセージが表示されること。
    expect(screen.getByText('処理済みのレポートはありません。')).toBeInTheDocument();
  });

  // WFL-FE-063: decision=approved の行のバッジが緑（承認）で表示される。
  it('WFL-FE-063: shows_approved_decision_badge — approved の処理結果バッジが表示される', () => {
    mockUseProcessedReports.mockReturnValue({
      data: {
        data: [mockProcessedReports[0]], // decision=approved のレポート
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // 「承認」バッジが表示されること。
    expect(screen.getByText('承認')).toBeInTheDocument();
    // セルの data-decision 属性が 'approved' であること。
    expect(screen.getByTestId('decision-cell-report-approved-001')).toHaveAttribute('data-decision', 'approved');
  });

  // WFL-FE-064: decision=rejected の行のバッジが赤（却下）で表示される。
  it('WFL-FE-064: shows_rejected_decision_badge — rejected の処理結果バッジが表示される', () => {
    mockUseProcessedReports.mockReturnValue({
      data: {
        data: [mockProcessedReports[1]], // decision=rejected のレポート
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // 「却下」バッジが表示されること。
    expect(screen.getByText('却下')).toBeInTheDocument();
    // セルの data-decision 属性が 'rejected' であること。
    expect(screen.getByTestId('decision-cell-report-rejected-001')).toHaveAttribute('data-decision', 'rejected');
  });

  // WFL-FE-065: current_status=paid のレポートが現在ステータス列に paid と表示される。
  it('WFL-FE-065: shows_current_status_badge — paid ステータスが正しく表示される', () => {
    mockUseProcessedReports.mockReturnValue({
      data: {
        data: [mockProcessedReports[0]], // current_status=paid のレポート
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // 現在ステータスセルの data-status 属性が 'paid' であること。
    expect(screen.getByTestId('status-cell-report-approved-001')).toHaveAttribute('data-status', 'paid');
  });

  // WFL-FE-066: Approver 以外のロール（member）は、同期ロールチェックでダッシュボードにリダイレクトされる。
  it('WFL-FE-066: redirects_non_approver_to_dashboard — Approver 以外はダッシュボードにリダイレクトされる', async () => {
    mockCurrentUserWithRole('member');
    mockUseProcessedReports.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // 同期ロールチェックによりダッシュボードにリダイレクトされること。
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    // navigate の state にトーストメッセージが含まれること。
    await waitFor(() => {
      expect(screen.getByTestId('nav-toast-message')).toHaveTextContent('この画面にアクセスする権限がありません。');
    });

    // ProcessedReportsPage は描画されないこと。
    expect(screen.queryByTestId(PROCESSED_PAGE_TEST_ID)).not.toBeInTheDocument();
  });

  // WFL-FE-066b: Admin ロールも即ダッシュボードへリダイレクトされる（Approver のみ許可）。
  it('WFL-FE-066b: admin_redirects_to_dashboard — Admin ロールはダッシュボードにリダイレクトされる', async () => {
    mockCurrentUserWithRole('admin');
    mockUseProcessedReports.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  // WFL-FE-067: レポート行をクリックすると /reports/:id に遷移する。
  it('WFL-FE-067: navigates_to_detail_on_row_click — 行クリックで /reports/:id に遷移する', async () => {
    const user = userEvent.setup();
    mockUseProcessedReports.mockReturnValue({
      data: {
        data: [mockProcessedReports[0]],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage();

    // AppDataGrid モックの行をクリックする。
    const row = screen.getByTestId('processed-report-row-report-approved-001');
    await user.click(row);

    // /reports/report-approved-001 に遷移すること。
    await waitFor(() => {
      const location = screen.getByTestId('location').textContent ?? '';
      expect(location).toContain('/reports/report-approved-001');
    });
  });

  // WFL-FE-068: per_page セレクタで値を変更すると per_page が更新され、page=1 にリセットされる。
  it('WFL-FE-068: per_page_selector_updates_url — per_page 変更時に page=1 リセットが行われる', async () => {
    const user = userEvent.setup();
    mockUseProcessedReports.mockReturnValue({
      data: {
        data: mockProcessedReports,
        pagination: { current_page: 1, per_page: 20, total_count: 2, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/approvals/processed?page=2&per_page=20');

    // PageSizeSelector の select を変更する。
    const selectEl = screen.getByTestId('page-size-select');
    await user.selectOptions(selectEl, '10');

    // useProcessedReports に per_page: 10, page: 1 が渡されること。
    await waitFor(() => {
      expect(mockUseProcessedReports).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 10, page: 1 }),
      );
    });
  });

  // WFL-FE-069: isLoading=true のとき PageSkeleton（variant: "table"）が表示される。
  it('WFL-FE-069: shows_skeleton_when_loading — isLoading=true のとき PageSkeleton が表示される', () => {
    mockUseProcessedReports.mockReturnValue({
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
});
