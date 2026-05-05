// ReportListPage のユニットテスト。
// RPT-FE-001〜007 に対応する。
// report-list.md §ReportListPage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import ReportListPage from '../ReportListPage';

// AppDataGrid を軽量な HTMLTable モックで差し替える。
// MUI X DataGrid は jsdom 環境で ESM import 問題が発生するため、テスト時はモックする（ReportListTable.test.tsx と同方針）。
// slots.footer を受け取り DataGrid フッターコンテナ相当の div 内で描画する（issue #147 再オープン D-1 中間ラッパー経由パターン検証用）。
vi.mock('../../../components/ui/AppDataGrid', () => ({
  default: (props: {
    rows: Array<{ id: string; title: string; periodStart: string; periodEnd: string; totalAmount: number; status: string; createdAt: string }>;
    columns: unknown[];
    onRowClick?: (params: { row: unknown }) => void;
    loading?: boolean;
    slots?: { footer?: () => import('react').ReactNode };
  }) => {
    if (props.loading) return <div data-testid="app-data-grid-loading">Loading...</div>;
    return (
      <div>
        <table data-testid="app-data-grid">
          <tbody>
            {props.rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => props.onRowClick?.({ row })}
                data-testid={`row-${row.id}`}
              >
                <td>{row.title}</td>
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

// StatusChip をモックする。
vi.mock('../../../components/ui/StatusChip', () => ({
  default: (props: { status: string }) => <span data-testid="status-chip">{props.status}</span>,
}));

// EmptyState をモックする。
vi.mock('../../../components/ui/EmptyState', () => ({
  default: (props: { message: string; action?: { label: string; onClick: () => void } }) => (
    <div data-testid="empty-state">
      <p>{props.message}</p>
      {props.action && (
        <button onClick={props.action.onClick}>{props.action.label}</button>
      )}
    </div>
  ),
}));

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
    // ReportListTable（DataGrid ベース）のモックは data-testid="row-{id}" を使用する。
    const row = screen.getByTestId('row-test-id-001');
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

  // RPT-FE-006b: isLoading=true のとき、ヘッダー・フィルタが表示される（issue 116 対応）。
  // スケルトン表示はテーブル領域のみとし、ヘッダー・フィルタは常時表示される設計に基づく。
  it('RPT-FE-006b: isLoading=true でもヘッダー（タイトル・作成ボタン）とフィルタ UI が表示される', () => {
    mockUseMyReports.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports');

    // ページヘッダーが表示されること（タイトル「マイレポート」を含む）。
    expect(screen.getByTestId('report-list-header')).toBeInTheDocument();
    // 「+ レポート作成」ボタンが表示されること。
    expect(screen.getByTestId('create-report-button')).toBeInTheDocument();
    // フィルタ UI が表示されること。
    expect(screen.getByTestId('report-list-filter')).toBeInTheDocument();
    // テーブルは表示されないこと（スケルトンで代替）。
    expect(screen.queryByTestId('report-list-table')).not.toBeInTheDocument();
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

  // RPT-FE-117: フィルタエリアが flex-wrap レイアウトで構成され、各フィルタ要素が存在すること（issue #165）。
  // フィルタエリアの Box が data-testid="report-list-filter" で取得でき、
  // ステータス・開始日・終了日の各入力要素が含まれること。
  it('RPT-FE-117: フィルタエリアが flex-wrap 構造で描画され、各フィルタ要素が存在する', async () => {
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

    // data-testid="report-list-filter" のコンテナが描画されること。
    const filterBox = screen.getByTestId('report-list-filter');
    expect(filterBox).toBeInTheDocument();

    // flex-wrap レイアウトの検証。
    // JSDOM 環境では emotion の sx prop は計算済み CSS にならないため、
    // window.getComputedStyle での flexWrap 検証は機能しない（W-1 JSDOM 制約）。
    // 代わりにコンテナ要素の存在と各フィルタ要素の DOM 存在を検証することで
    // flex-wrap 構造の意図（sx={{ display: 'flex', flexWrap: 'wrap' }}）を粗く担保する。
    // 実 CSS の flex-wrap 検証は E2E テスト（Playwright 等）で行うこと。

    // ステータスフィルタ（AppSelect）が存在すること。
    expect(screen.getByTestId('report-list-filter-status')).toBeInTheDocument();

    // 開始日フィルタが存在すること。
    // input[type="date"] は JSDOM で role="textbox" として認識されないため data-testid で取得する（B-1 対応）。
    const fromInput = screen.getByTestId('report-list-filter-from');
    expect(fromInput).toBeInTheDocument();

    // 終了日フィルタが存在すること。
    // 同様に data-testid で取得する（B-1 対応）。
    const toInput = screen.getByTestId('report-list-filter-to');
    expect(toInput).toBeInTheDocument();

    // フィルタ要素が filterBox コンテナ内に含まれること（DOM 親子関係を検証）。
    expect(filterBox).toContainElement(fromInput);
    expect(filterBox).toContainElement(toInput);
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
    // PageSizeSelector も combobox を持つため testid でステータスフィルタを特定する。
    await waitFor(() => {
      const statusCombobox = screen.getByTestId('report-list-filter-status');
      expect(statusCombobox).toHaveTextContent('すべて');
    });
  });

  // =============================================================================
  // issue #147: per_page UI セレクタ + URL 駆動 Page 結合テスト（RPT-FE-111〜114）
  // =============================================================================

  // RPT-FE-111: /reports?per_page=10 で開く
  // → テーブルに 10 件のみ描画される。フッターの PageSizeSelector が「10」を表示する。
  //    useMyReports への引数に per_page: 10 が渡り、API URL に ?per_page=10 が含まれる。
  it('RPT-FE-111: test_ReportListPage_url_per_page_reflects_to_selector_and_api — URL の per_page=10 が PageSizeSelector と API 引数に反映される', async () => {
    // RPT-FE-111
    // MSW で useMyReports が 10 件 + pagination.total_pages > 1 を返すよう設定する。
    const reports10 = Array.from({ length: 10 }, (_, i) => ({
      id: `test-id-${String(i + 1).padStart(3, '0')}`,
      title: `レポート${i + 1}`,
      period_start: '2026-03-01',
      period_end: '2026-03-31',
      status: 'draft' as const,
      total_amount: (i + 1) * 1000,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    }));

    mockUseMyReports.mockReturnValue({
      data: {
        data: reports10,
        pagination: { current_page: 1, per_page: 10, total_count: 30, total_pages: 3 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // URL に per_page=10 を設定してページを開く。
    renderPage('/reports?per_page=10');

    // useMyReports に per_page: 10 が渡されること（URL → Hook 反映）。
    await waitFor(() => {
      expect(mockUseMyReports).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 10 }),
      );
    });

    // フッターの PageSizeSelector が「10」を現在値として表示すること。
    // AppPaginationFooter 内の PageSizeSelector を検証する。
    // スタブ実装（PageSizeSelector 未存在）のため失敗するが β2 テスト先行仕様で許容する。
    await waitFor(() => {
      const selector = screen.getByTestId('page-size-selector');
      expect(selector).toHaveTextContent('10');
    });
  });

  // RPT-FE-112: /reports?page=3&per_page=10 で開いた状態で PageSizeSelector から「50」を選択
  // → URL が /reports?page=1&per_page=50 に更新される（page=1 リセット）。
  //    setSearchParams は 1 回のコールに集約される（race 回避、重要リスク 5）。
  //    PageSizeSelector の現在値が「50」に更新される。
  it('RPT-FE-112: test_ReportListPage_selector_change_updates_url_and_resets_page — per_page 変更時に page=1 リセット + setSearchParams 1 コール集約（重要リスク 5）', async () => {
    // RPT-FE-112
    const user = userEvent.setup();

    mockUseMyReports.mockReturnValue({
      data: {
        data: mockReports,
        pagination: { current_page: 3, per_page: 10, total_count: 30, total_pages: 3 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // page=3, per_page=10 の状態でページを開く。
    renderPage('/reports?page=3&per_page=10');

    // PageSizeSelector が描画されるまで待機する。
    // スタブ実装（PageSizeSelector 未存在）のため失敗するが β2 テスト先行仕様で許容する。
    const selector = screen.getByTestId('page-size-selector');
    const combobox = within(selector).getByRole('combobox');
    await user.click(combobox);

    // 「50 件」の選択肢をクリックして per_page を変更する（実装は "{size} 件" 形式で表示）。
    const option50 = await screen.findByRole('option', { name: '50 件' });
    await user.click(option50);

    // URL が /reports?page=1&per_page=50 に更新されること（page=1 リセット）。
    await waitFor(() => {
      const locationText = screen.getByTestId('location').textContent ?? '';
      expect(locationText).toContain('page=1');
      expect(locationText).toContain('per_page=50');
    });

    // useMyReports に per_page: 50, page: 1 が渡されること。
    await waitFor(() => {
      expect(mockUseMyReports).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 50, page: 1 }),
      );
    });
  });

  // RPT-FE-113: /reports?per_page=1 で開く（URL に標準外値）
  // → PageSizeSelector の選択肢が [1, 10, 20, 50, 100] に動的拡張され、現在値「1」が選択される。
  //    （パターン X 動作。Hook 側にも per_page=1 が渡る）
  it('RPT-FE-113: test_ReportListPage_url_non_standard_per_page_appends_to_options — URL の標準外 per_page=1 が PageSizeSelector 選択肢に動的追加される', async () => {
    // RPT-FE-113
    const user = userEvent.setup();

    mockUseMyReports.mockReturnValue({
      data: {
        data: [mockReports[0]],
        pagination: { current_page: 1, per_page: 1, total_count: 3, total_pages: 3 },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // URL に標準外値 per_page=1 を設定してページを開く。
    renderPage('/reports?per_page=1');

    // useMyReports に per_page: 1 が渡されること（URL → Hook 反映）。
    await waitFor(() => {
      expect(mockUseMyReports).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 1 }),
      );
    });

    // PageSizeSelector を開いて選択肢を確認する。
    // スタブ実装（PageSizeSelector 未存在）のため失敗するが β2 テスト先行仕様で許容する。
    const selector = screen.getByTestId('page-size-selector');
    const combobox = within(selector).getByRole('combobox');
    await user.click(combobox);

    // 選択肢が [1, 10, 20, 50, 100] の 5 件に動的拡張されること。
    // MUI MenuItem は "{size} 件" 形式で表示するため parseInt で数値を抽出する。
    const options = screen.getAllByRole('option');
    const values = options.map((o) => parseInt(o.textContent ?? '', 10));
    expect(values).toEqual([1, 10, 20, 50, 100]);

    // 現在値として「1」が選択されていること。
    expect(screen.getByTestId('page-size-selector')).toHaveTextContent('1');
  });

  // RPT-FE-114: /reports?per_page=abc（NaN ケース）と /reports?per_page=-5（負数ケース）の 2 サブケース
  // → 両サブケースとも useMyReports への引数 per_page が 20（FE フォールバック）になり、
  //    PageSizeSelector も「20」を表示する（issue #147 Q4: FE 側 fail-soft、重要リスク 2）。
  it('RPT-FE-114: test_ReportListPage_url_invalid_per_page_falls_back_to_20 — NaN/負数の per_page は 20 にフォールバックされる（重要リスク 2）', async () => {
    // RPT-FE-114
    // サブケース 1: per_page=abc（NaN）
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

    const { unmount } = renderPage('/reports?per_page=abc');

    // useMyReports に per_page: 20（フォールバック）が渡されること。
    await waitFor(() => {
      expect(mockUseMyReports).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 20 }),
      );
    });

    // NaN の場合 per_page=20 で呼ばれ、per_page の値が 20 以外で呼ばれていないこと。
    const nanCalls = mockUseMyReports.mock.calls.filter(
      (args) => Number.isNaN(args[0]?.per_page),
    );
    expect(nanCalls).toHaveLength(0);

    unmount();
    vi.clearAllMocks();

    // サブケース 2: per_page=-5（負数）
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

    renderPage('/reports?per_page=-5');

    // useMyReports に per_page: 20（フォールバック）が渡されること。
    await waitFor(() => {
      expect(mockUseMyReports).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 20 }),
      );
    });

    // 負数の場合 per_page=-5 で呼ばれていないこと。
    const negativeCalls = mockUseMyReports.mock.calls.filter(
      (args) => (args[0]?.per_page ?? 0) < 0,
    );
    expect(negativeCalls).toHaveLength(0);
  });
});
