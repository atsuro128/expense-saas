// ReportListPage のユニットテスト。
// RPT-FE-001〜007 に対応する。
// report-list.md §ReportListPage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import ReportListPage from '../ReportListPage';

// useMyReports Hook をモックする。
// スタブ実装段階では実際の Hook は存在しないため vi.mock でインターセプトする。
vi.mock('../../../hooks/useReports', () => ({
  useMyReports: vi.fn(),
}));

// vi.mock 後に import することでモック済みの関数参照を取得する。
import { useMyReports } from '../../../hooks/useReports';

const mockUseMyReports = vi.mocked(useMyReports);

// テスト用レポートデータ（3件）。
const mockReports = [
  {
    id: 'test-id-001',
    title: 'レポート1',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    status: 'draft' as const,
    total_amount: 10000,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'test-id-002',
    title: 'レポート2',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    status: 'submitted' as const,
    total_amount: 20000,
    created_at: '2026-03-02T00:00:00Z',
    updated_at: '2026-03-02T00:00:00Z',
  },
  {
    id: 'test-id-003',
    title: 'レポート3',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    status: 'approved' as const,
    total_amount: 30000,
    created_at: '2026-03-03T00:00:00Z',
    updated_at: '2026-03-03T00:00:00Z',
  },
];

// ルーティングによる遷移先を検証するためのヘルパーコンポーネント。
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage(initialEntry = '/reports') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reports" element={<ReportListPage />} />
          <Route path="/reports/new" element={<div data-testid="create-page">create-page</div>} />
          <Route path="/reports/:id" element={<div data-testid="detail-page">detail-page</div>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportListPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // RPT-FE-001: useMyReports が 3 件のレポートデータを返す
  // → ReportListHeader, ReportListFilter, ReportListTable, AppPagination が描画される
  // （report-list.md §ReportListPage: URL クエリパラメータからフィルタ条件を復元し useMyReports でデータ取得）
  it('RPT-FE-001: useMyReports が 3 件返ると ReportListHeader/Filter/Table/Pagination が描画される', async () => {
    // useMyReports が成功レスポンスで 3 件のデータを返すようにモックする。
    // totalPages を 2 に設定し、AppPagination が描画されるようにする。
    mockUseMyReports.mockReturnValue({
      data: {
        data: mockReports,
        pagination: { current_page: 1, per_page: 20, total_count: 3, total_pages: 2 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports');

    // ReportListHeader が描画されること（「マイレポート」タイトルまたは作成ボタンを含む）。
    // スタブ実装では ReportListHeader が存在しないため失敗する。
    expect(screen.getByTestId('report-list-header')).toBeInTheDocument();

    // ReportListFilter が描画されること。
    // スタブ実装では ReportListFilter が存在しないため失敗する。
    expect(screen.getByTestId('report-list-filter')).toBeInTheDocument();

    // ReportListTable が描画されること。
    // スタブ実装では ReportListTable が存在しないため失敗する。
    expect(screen.getByTestId('report-list-table')).toBeInTheDocument();

    // AppPagination が描画されること。
    // スタブ実装では AppPagination が存在しないため失敗する。
    expect(screen.getByTestId('app-pagination')).toBeInTheDocument();
  });

  // RPT-FE-002: URL クエリパラメータ ?status=draft&from=2026-03-01&to=2026-03-31 が設定されている
  // → ReportListFilter にフィルタ値が反映される。useMyReports にフィルタパラメータが渡される
  // （report-list.md §ReportListPage: URL クエリパラメータからフィルタ条件を復元）
  it('RPT-FE-002: URL クエリパラメータのフィルタ値が ReportListFilter に反映され useMyReports に渡される', async () => {
    mockUseMyReports.mockReturnValue({
      data: {
        data: mockReports,
        pagination: { current_page: 1, per_page: 20, total_count: 3, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports?status=draft&from=2026-03-01&to=2026-03-31');

    await waitFor(() => {
      // ステータス combobox に URL の status 値（draft）が反映されていること。
      // スタブ実装では ReportListFilter が未実装のため失敗する。
      const statusSelect = screen.getByTestId('report-list-filter-status');
      expect(statusSelect).toHaveValue('draft');
    });

    await waitFor(() => {
      // 開始日 input に URL の from 値が反映されていること。
      // スタブ実装では ReportListFilter が未実装のため失敗する。
      const fromInput = screen.getByTestId('report-list-filter-from');
      expect(fromInput).toHaveValue('2026-03-01');
    });

    await waitFor(() => {
      // 終了日 input に URL の to 値が反映されていること。
      // スタブ実装では ReportListFilter が未実装のため失敗する。
      const toInput = screen.getByTestId('report-list-filter-to');
      expect(toInput).toHaveValue('2026-03-31');
    });

    await waitFor(() => {
      // useMyReports が status=draft, from=2026-03-01, to=2026-03-31 のパラメータで呼び出されること。
      // スタブ実装では useMyReports が未実装のため失敗する。
      expect(mockUseMyReports).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft',
          from: '2026-03-01',
          to: '2026-03-31',
        }),
      );
    });
  });

  // RPT-FE-003: ページ 2 を表示中にステータスフィルタを変更
  // → URL クエリパラメータの page が 1 にリセットされる
  // （report-list.md §ReportListPage: フィルタ変更時に URL クエリパラメータを更新して page を 1 にリセット）
  it('RPT-FE-003: フィルタ変更時に URL の page が 1 にリセットされる', async () => {
    const user = userEvent.setup();

    mockUseMyReports.mockReturnValue({
      data: {
        data: mockReports,
        pagination: { current_page: 2, per_page: 20, total_count: 3, total_pages: 2 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // 初期状態を page=2, status=draft でレンダリングする。
    renderPage('/reports?page=2&status=draft');

    // ステータスフィルタ（AppSelect）を操作してフィルタを別の値（approved）に変更する。
    // スタブ実装では ReportListFilter が存在しないため失敗する。
    const statusSelect = screen.getByTestId('report-list-filter-status');
    // ステータスセレクトを開いて「承認済み」を選択することでフィルタ値を変更する。
    await user.click(statusSelect);
    // ドロップダウンの選択肢「承認済み」（value="approved"）をクリックする。
    // スタブ実装では選択肢が存在しないため失敗する。
    const approvedOption = await screen.findByRole('option', { name: /承認済み/ });
    await user.click(approvedOption);

    // フィルタ値が draft から approved に変更されたことで page=1 にリセットされること。
    // フィルタ変更後に useMyReports が page=1, status=approved で呼び出されること。
    await waitFor(() => {
      expect(mockUseMyReports).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          status: 'approved',
        }),
      );
    });

    // URL クエリパラメータに page=1 と status=approved が反映されていること。
    // フィルタ変更時に URL を書き換えない実装では通らない。
    await waitFor(() => {
      const locationText = screen.getByTestId('location').textContent ?? '';
      expect(locationText).toContain('page=1');
      expect(locationText).toContain('status=approved');
    });
  });

  // RPT-FE-004: テーブル行をクリック（reportId = "test-id-001"）
  // → /reports/test-id-001 に遷移する
  // （report-list.md §ReportListPage: onRowClick コールバックで navigate('/reports/:id')）
  it('RPT-FE-004: テーブル行クリックで /reports/:id に遷移する', async () => {
    const user = userEvent.setup();

    mockUseMyReports.mockReturnValue({
      data: {
        data: mockReports,
        pagination: { current_page: 1, per_page: 20, total_count: 3, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports');

    // テーブル行をクリックする。
    // スタブ実装では ReportListTable が存在しないため失敗する。
    const row = screen.getByTestId('report-row-test-id-001');
    await user.click(row);

    // /reports/test-id-001 に遷移すること。
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/reports/test-id-001');
    });
  });

  // RPT-FE-005: レポート作成ボタンをクリック
  // → /reports/new に遷移する
  // （report-list.md §ReportListPage: onCreateReport コールバックで navigate('/reports/new')）
  it('RPT-FE-005: レポート作成ボタン押下で /reports/new に遷移する', async () => {
    const user = userEvent.setup();

    mockUseMyReports.mockReturnValue({
      data: {
        data: mockReports,
        pagination: { current_page: 1, per_page: 20, total_count: 3, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports');

    // 「+ レポート作成」ボタンをクリックする。
    // スタブ実装では ReportListHeader/CreateReportButton が存在しないため失敗する。
    const createButton = screen.getByTestId('create-report-button');
    await user.click(createButton);

    // /reports/new に遷移すること。
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/reports/new');
    });
  });

  // RPT-FE-006: useMyReports の isLoading が true
  // → PageSkeleton（variant: 'table'）が表示される
  // （report-list.md コンポーネントツリー: データ読み込み中は PageSkeleton 表示）
  it('RPT-FE-006: useMyReports isLoading=true のとき PageSkeleton（variant=table）が表示される', () => {
    mockUseMyReports.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports');

    // PageSkeleton が表示されること（variant='table'）。
    // スタブ実装では PageSkeleton が存在しないため失敗する。
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
    // variant='table' が設定されていること。
    expect(screen.getByTestId('page-skeleton')).toHaveAttribute('data-variant', 'table');
  });

  // RPT-FE-007: useMyReports がエラーを返す
  // → AppToast（severity: 'error'）が表示される
  // （report-list.md §ReportListPage: API エラー時は AppToast で error 表示）
  it('RPT-FE-007: useMyReports がエラーを返すと AppToast（severity=error）が表示される', async () => {
    mockUseMyReports.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('API エラー'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports');

    // AppToast（severity='error'）が表示されること。
    // スタブ実装では AppToast が存在しないため失敗する。
    await waitFor(() => {
      expect(screen.getByTestId('app-toast')).toBeInTheDocument();
      expect(screen.getByTestId('app-toast')).toHaveAttribute('data-severity', 'error');
    });
  });

  // REGRESSION-ReportListPage-1: codex 指摘の回帰防止テスト。
  // 初期状態（status=''）でステータスフィルタの combobox 内に「すべて」が表示されること。
  // AppSelect の displayEmpty={!!placeholder} 変更（PR #55）で「すべて」が消える回帰を検出する。
  it('REGRESSION-ReportListPage-1: フィルタ初期状態でステータス combobox に「すべて」が表示される', async () => {
    mockUseMyReports.mockReturnValue({
      data: {
        data: mockReports,
        pagination: { current_page: 1, per_page: 20, total_count: 3, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports');

    // ステータスフィルタ（AppSelect）の combobox 表示部に「すべて」が表示されること。
    // MUI Select は displayEmpty=true のとき value="" の MenuItem を表示する。
    await waitFor(() => {
      const statusCombobox = screen.getByRole('combobox');
      expect(statusCombobox).toHaveTextContent('すべて');
    });
  });
});
