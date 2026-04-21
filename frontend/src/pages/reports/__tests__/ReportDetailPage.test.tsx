// ReportDetailPage のユニットテスト。
// RPT-FE-064〜069 に対応する。
// report-detail.md §ReportDetailPage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import ReportDetailPage from '../ReportDetailPage';

// useReport / useSubmitReport / useDeleteReport / useCurrentUser Hook をモックする。
// スタブ実装段階では実際の Hook は存在しないため vi.mock でインターセプトする。
vi.mock('../../../hooks/useReports', () => ({
  useReport: vi.fn(),
  useSubmitReport: vi.fn(),
  useDeleteReport: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

// useCategories をモックする（ItemSlidePanel 経由で参照）。
vi.mock('../../../hooks/useCategories', () => ({
  useCategories: vi.fn(),
}));

// useItems（useCreateItem / useUpdateItem / useDeleteItem）をモックする。
vi.mock('../../../hooks/useItems', () => ({
  useCreateItem: vi.fn(),
  useUpdateItem: vi.fn(),
  useDeleteItem: vi.fn(),
}));

// useApproveReport / useRejectReport / useMarkAsPaid をモックする（ワークフロー操作テスト用）。
vi.mock('../../../hooks/useApproveReport', () => ({
  useApproveReport: vi.fn(),
}));

vi.mock('../../../hooks/useRejectReport', () => ({
  useRejectReport: vi.fn(),
}));

vi.mock('../../../hooks/useMarkAsPaid', () => ({
  useMarkAsPaid: vi.fn(),
}));

// vi.mock 後に import することでモック済みの関数参照を取得する。
import { useReport, useSubmitReport, useDeleteReport } from '../../../hooks/useReports';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useCategories } from '../../../hooks/useCategories';
import { useCreateItem, useUpdateItem, useDeleteItem } from '../../../hooks/useItems';
import { useApproveReport } from '../../../hooks/useApproveReport';
import { useRejectReport } from '../../../hooks/useRejectReport';
import { useMarkAsPaid } from '../../../hooks/useMarkAsPaid';

const mockUseReport = vi.mocked(useReport);
const mockUseSubmitReport = vi.mocked(useSubmitReport);
const mockUseDeleteReport = vi.mocked(useDeleteReport);
const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUseCategories = vi.mocked(useCategories);
const mockUseCreateItem = vi.mocked(useCreateItem);
const mockUseUpdateItem = vi.mocked(useUpdateItem);
const mockUseDeleteItem = vi.mocked(useDeleteItem);
const mockUseApproveReport = vi.mocked(useApproveReport);
const mockUseRejectReport = vi.mocked(useRejectReport);
const mockUseMarkAsPaid = vi.mocked(useMarkAsPaid);

// テスト用 draft 状態のレポート詳細データ（Test Member 所有、明細1件あり）。
const mockDraftReportDetail = {
  id: 'test-report-id',
  title: '出張費 3月',
  period_start: '2026-03-01',
  period_end: '2026-03-31',
  status: 'draft' as const,
  total_amount: 50000,
  submitter: { id: 'current-user-id', name: 'テスト太郎' },
  items: [
    {
      id: 'item-001',
      report_id: 'test-report-id',
      expense_date: '2026-03-10',
      amount: 50000,
      category: { id: 'cat-001', code: 'TRANSPORT', name_ja: '交通費', sort_order: 1 },
      description: '新幹線代',
      attachments: [],
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    },
  ],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

// テスト用の現在ユーザー（レポートの所有者）。
const mockCurrentUser = {
  id: 'current-user-id',
  name: 'テスト太郎',
  email: 'test@example.com',
  role: 'member' as const,
  tenant: { id: 'tenant-id', name: 'テナントA' },
};

// ルーティングによる遷移先を検証するためのヘルパーコンポーネント。
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage(
  reportId = 'test-report-id',
  queryClient?: QueryClient,
  initialState?: Record<string, unknown>,
) {
  const client = queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // location.state を渡す場合は initialEntries に state 付きのエントリを使用する。
  const initialEntry = initialState
    ? { pathname: `/reports/${reportId}`, state: initialState }
    : `/reports/${reportId}`;
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/reports" element={<div data-testid="reports-list">reports-list</div>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient: client };
}

describe('ReportDetailPage', () => {
  // 各テスト前に useItems / useCategories のデフォルトモックを設定する。
  // これらのフックは ReportDetailPage が常に呼ぶため、最低限の返り値が必要。
  // プリフィル検証で使用するカテゴリデータ。
  // 明細データの category.id と一致させることで MUI Select が正しく描画される。
  const mockCategories = [
    { id: 'cat-001', code: 'TRANSPORT', name_ja: '交通費', sort_order: 1 },
    { id: 'cat-002', code: 'FOOD', name_ja: '食費', sort_order: 2 },
  ];

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCategories.mockReturnValue({ data: mockCategories, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreateItem.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseUpdateItem.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteItem.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // ワークフロー操作フックのデフォルトモックを設定する。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseApproveReport.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseRejectReport.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseMarkAsPaid.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // RPT-FE-064: useReport が draft 状態のレポート詳細データを返す
  // → ReportInfoCard, ReportActionBar が描画される
  // （report-detail.md §ReportDetailPage: レポートデータを読み込み子コンポーネントに伝播）
  it('RPT-FE-064: useReport がデータを返すと ReportInfoCard と ReportActionBar が描画される', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // useReport が draft レポートデータを返すようにモックする。
    // スタブ実装では useReport が未実装のため失敗する。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // ReportInfoCard が描画されること。
    // スタブ実装では ReportInfoCard が存在しないため失敗する。
    await waitFor(() => {
      expect(screen.getByTestId('report-info-card')).toBeInTheDocument();
    });

    // ReportActionBar が描画されること。
    // スタブ実装では ReportActionBar が存在しないため失敗する。
    expect(screen.getByTestId('report-action-bar')).toBeInTheDocument();
  });

  // RPT-FE-065: useReport の isLoading が true
  // → PageSkeleton が表示される
  // （report-detail.md コンポーネントツリー: データ読み込み中は PageSkeleton 表示）
  it('RPT-FE-065: useReport isLoading=true のとき PageSkeleton が表示される', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // useReport がローディング中を返すようにモックする。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // PageSkeleton が表示されること。
    // スタブ実装では PageSkeleton が存在しないため失敗する。
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  // RPT-FE-066: useReport が 404 を返す
  // → 「指定されたデータが見つかりません。」メッセージとレポート一覧へのリンクが表示される
  // （report-detail.md §ReportDetailPage: レポートが存在しない場合は not found メッセージ表示）
  it('RPT-FE-066: useReport が 404 を返すと not found メッセージとレポート一覧リンクが表示される', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // useReport が 404 エラーを返すようにモックする。
    const notFoundError = Object.assign(new Error('Not Found'), { status: 404, code: 'RESOURCE_NOT_FOUND' });
    mockUseReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: notFoundError,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('non-existent-id');

    // 「指定されたデータが見つかりません。」メッセージが表示されること。
    // スタブ実装では 404 処理が存在しないため失敗する。
    await waitFor(() => {
      expect(screen.getByText('指定されたデータが見つかりません。')).toBeInTheDocument();
    });

    // レポート一覧へのリンクが表示されること。
    expect(screen.getByRole('link', { name: /レポート一覧/ })).toBeInTheDocument();
  });

  // RPT-FE-067: 提出ボタン押下後、確認ダイアログで「はい」を選択
  // → useSubmitReport が実行され、成功後にレポートデータが更新される
  // （report-detail.md §ReportDetailPage: 全ワークフロー操作の確認ダイアログ制御を管理）
  it('RPT-FE-067: 提出ボタン押下後にダイアログで確認すると useSubmitReport が実行され成功後にデータが更新される', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);

    // useSubmitReport の mutate が呼ばれた時に onSuccess コールバックを即座に発火するモック。
    // これにより「成功後のデータ更新」という期待動作が実行される。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submitMutate = vi.fn().mockImplementation((_data: unknown, options?: any) => { options?.onSuccess?.(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: submitMutate, isPending: false, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    // queryClient の invalidateQueries が提出成功後に呼ばれることを検証するため、
    // queryClient を外部から渡してスパイを仕掛ける。
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderPage('test-report-id', queryClient);

    // 提出ボタンをクリックする。
    // スタブ実装では OwnerActions が存在しないため失敗する。
    const submitButton = screen.getByRole('button', { name: /提出/ });
    await user.click(submitButton);

    // 確認ダイアログが表示されること。
    // スタブ実装では ConfirmDialog が存在しないため失敗する。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // ダイアログで「はい」ボタンをクリックする。
    const confirmButton = screen.getByRole('button', { name: /はい/ });
    await user.click(confirmButton);

    // useSubmitReport の mutate が呼び出されること。
    await waitFor(() => {
      expect(submitMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-report-id' }),
        expect.any(Object),
      );
    });

    // 提出成功後にレポートデータが更新されること。
    // onSuccess コールバックが発火し、queryClient.invalidateQueries でキャッシュが更新される。
    // スタブ実装ではこのキャッシュ無効化が行われないため失敗する。
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'detail', 'test-report-id'] }),
      );
    });
  });

  // RPT-FE-068: 削除ボタン押下後、確認ダイアログで「はい」を選択
  // → useDeleteReport が実行され、成功後に /reports に遷移する
  // （report-detail.md §ReportDetailPage: 削除確認ダイアログ制御と成功後の遷移）
  it('RPT-FE-068: 削除ボタン押下後にダイアログで確認すると useDeleteReport が実行され /reports に遷移する', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    // useDeleteReport の mutate が呼ばれた後に /reports に遷移することを検証する。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteMutate = vi.fn().mockImplementation((_id: unknown, options?: any) => { options?.onSuccess?.(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: deleteMutate, isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 削除ボタンをクリックする。
    // OwnerActions のレポート削除ボタン（1番目）をクリックする。
    // ItemTable にも明細削除ボタンが存在するため getAllByRole で取得し先頭を使用する。
    const deleteButtons = screen.getAllByRole('button', { name: /削除/ });
    await user.click(deleteButtons[0]!);

    // 確認ダイアログが表示されること。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // ダイアログで「はい」ボタンをクリックする。
    const confirmButton = screen.getByRole('button', { name: /はい/ });
    await user.click(confirmButton);

    // useDeleteReport の mutate が呼び出されること。
    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith(
        'test-report-id',
        expect.any(Object),
      );
    });

    // 成功後に /reports に遷移すること。
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/reports');
    });
  });

  // RPT-FE-069: 提出確認ダイアログで「キャンセル」を選択
  // → ダイアログが閉じ、ミューテーションは実行されない
  // （report-detail.md §ReportDetailPage: ConfirmDialog のキャンセルで操作を中断）
  it('RPT-FE-069: 提出ダイアログでキャンセルを選択するとダイアログが閉じミューテーションは実行されない', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);

    // useSubmitReport の mutate が呼ばれないことを検証する。
    const submitMutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: submitMutate, isPending: false, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 提出ボタンをクリックする。
    // スタブ実装では OwnerActions が存在しないため失敗する。
    const submitButton = screen.getByRole('button', { name: /提出/ });
    await user.click(submitButton);

    // 確認ダイアログが表示されること。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // ダイアログで「キャンセル」ボタンをクリックする。
    const cancelButton = screen.getByRole('button', { name: /キャンセル/ });
    await user.click(cancelButton);

    // ダイアログが閉じること。
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // useSubmitReport の mutate が呼び出されていないこと。
    expect(submitMutate).not.toHaveBeenCalled();
  });

  // ITM-FE-098-3b: 明細行クリック時、パネルが一度 'closed' を経由してから再度開く（flushSync pattern）。
  // handleItemClick / handleEditItem が flushSync(() => setPanelState('closed')) → setPanelState('view')
  // パターンを使っていることを検証し、このパターンが削除されたら失敗するテストを担保する。
  //
  // 検証方法: userEvent.click で 2件の明細を連続クリックし、最終的なパネル表示状態を assert する。
  // flushSync により closed→open の遷移が同期的に確定するため、fake timers は不要。
  it('ITM-FE-098-3b: 編集中に別の明細行をクリックすると、flushSync pattern でパネルが再度開く', async () => {
    const user = userEvent.setup();

    // 2件の明細を持つレポートデータを使用する。
    const twoItemsReport = {
      ...mockDraftReportDetail,
      items: [
        {
          id: 'item-001',
          report_id: 'test-report-id',
          expense_date: '2026-03-10',
          amount: 50000,
          category: { id: 'cat-001', code: 'TRANSPORT', name_ja: '交通費', sort_order: 1 },
          description: '新幹線代',
          attachments: [],
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
        },
        {
          id: 'item-002',
          report_id: 'test-report-id',
          expense_date: '2026-03-11',
          amount: 3000,
          category: { id: 'cat-002', code: 'FOOD', name_ja: '食費', sort_order: 2 },
          description: '昼食代',
          attachments: [],
          created_at: '2026-03-02T00:00:00Z',
          updated_at: '2026-03-02T00:00:00Z',
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: twoItemsReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 1件目の明細行をクリックしてパネルを開く（panelState → 'closed' → 'view'）。
    // flushSync で closed が同期コミットされた後すぐ 'view' になるため、waitFor で表示を確認する。
    await user.click(screen.getByTestId('item-row-item-001'));
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // 1件目パネル表示中に 2件目の明細行をクリックする。
    // flushSync が同期的に closed→view の遷移を確定させるため、
    // fake timers は不要で、最終的に item-002 の内容でパネルが開いていることを確認できる。
    await user.click(screen.getByTestId('item-row-item-002'));
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // 2件目（item-002）の内容がパネルに表示されていること（切り替え成功の確認）。
    const panel = screen.getByTestId('item-slide-panel');
    expect(within(panel).getByDisplayValue('2026-03-11')).toBeInTheDocument();
    expect(within(panel).getByDisplayValue('3000')).toBeInTheDocument();
  });

  // ITM-FE-098-5: 行クリック直後に明細追加ボタンを押しても追加モードが維持される。
  // flushSync 置換により setTimeout の race の余地が消滅したことを多段操作で保証する。
  it('ITM-FE-098-5: 行クリック直後に明細追加ボタンを押しても追加モードが維持される', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 1. 行クリック → panelState が 'view' に遷移する（flushSync で closed→view が確定）。
    await user.click(screen.getByTestId('item-row-item-001'));
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // 2. 直後に「明細追加」ボタンをクリック → handleAddItem が setPanelState('add') を直接呼ぶ。
    // flushSync 置換により view に留まる旧 setTimeout の残存がないため、add に確実に遷移する。
    // MUI Drawer が open=true のとき body に aria-hidden がつくため、{ hidden: true } で取得する。
    const addButton = screen.getByRole('button', { name: /明細追加|追加/, hidden: true });
    await user.click(addButton);

    // 3. 最終状態: Drawer が開き「明細追加」モード（add）のヘッダーが表示されていること。
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });
    // add モードは ItemSlidePanel のタイトルが「明細追加」になることを確認する。
    // 旧 setTimeout が残存していれば view/edit の 'closed' 遷移後に view に戻ってしまい
    // 「明細詳細」が表示されたままになるが、flushSync 置換により add が確実に確定する。
    const panel = screen.getByTestId('item-slide-panel');
    expect(within(panel).getByText('明細追加')).toBeInTheDocument();
  });

  // ITM-FE-098-6: 編集クリック直後に別の行クリックしても最新の行の閲覧モードが維持される。
  // flushSync 置換により setTimeout の race の余地が消滅したことを多段操作で保証する。
  it('ITM-FE-098-6: 編集クリック直後に別の行クリックしても最新の行の閲覧モードが維持される', async () => {
    const user = userEvent.setup();

    // 2件の明細を持つレポートデータ。
    const twoItemsReport = {
      ...mockDraftReportDetail,
      items: [
        {
          id: 'item-001',
          report_id: 'test-report-id',
          expense_date: '2026-03-10',
          amount: 50000,
          category: { id: 'cat-001', code: 'TRANSPORT', name_ja: '交通費', sort_order: 1 },
          description: '新幹線代',
          attachments: [],
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
        },
        {
          id: 'item-002',
          report_id: 'test-report-id',
          expense_date: '2026-03-11',
          amount: 3000,
          category: { id: 'cat-002', code: 'FOOD', name_ja: '食費', sort_order: 2 },
          description: '昼食代',
          attachments: [],
          created_at: '2026-03-02T00:00:00Z',
          updated_at: '2026-03-02T00:00:00Z',
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: twoItemsReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 1. item-001 の編集ボタンをクリック → panelState が 'edit' に遷移する。
    const itemRow1 = screen.getByTestId('item-row-item-001');
    const editButton = within(itemRow1).getByRole('button', { name: /編集/ });
    await user.click(editButton);
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });
    // item-001 の値がプリフィルされていること。
    expect(within(screen.getByTestId('item-slide-panel')).getByDisplayValue('新幹線代')).toBeInTheDocument();

    // 2. 直後に item-002 の行クリック → handleItemClick が flushSync で closed→view に遷移。
    // flushSync により edit の setTimeout が残存しても上書きされない（そもそも setTimeout は消滅済み）。
    await user.click(screen.getByTestId('item-row-item-002'));
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // 3. 最終状態: item-002 の値がプリフィルされた閲覧モードのパネルが表示されていること。
    const panel = screen.getByTestId('item-slide-panel');
    expect(within(panel).getByDisplayValue('昼食代')).toBeInTheDocument();
    expect(within(panel).getByDisplayValue('3000')).toBeInTheDocument();
    // item-001 の値は表示されないこと。
    expect(within(panel).queryByDisplayValue('新幹線代')).not.toBeInTheDocument();
  });

  // RPT-FE-090-A: 明細行クリック時に ItemSlidePanel が開き、対象明細のプリフィル値が表示される。
  // （090: handleItemClick が formKey をインクリメントして ItemSlidePanel を再マウントし、フォームに既存値をプリフィルする）
  it('RPT-FE-090-A: 明細行クリックで ItemSlidePanel が表示され、フォームに対象明細の値がプリフィルされる', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 明細行をクリックする。
    // ItemTable に `data-testid="item-row-{itemId}"` の行が存在する。
    const itemRow = screen.getByTestId('item-row-item-001');
    await user.click(itemRow);

    // ItemSlidePanel（Drawer の Paper）が表示されること。
    // MUI Drawer は open=true になると PaperProps の data-testid が DOM に現れる。
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // パネル内のフォームに対象明細（item-001）の値がプリフィルされていること。
    // blocker issue 090: フォームプリフィル未実装が再発した場合にこのアサートで検出できる。
    const panel = screen.getByTestId('item-slide-panel');

    // 日付フィールドに '2026-03-10' がプリフィルされていること。
    const dateInput = within(panel).getByDisplayValue('2026-03-10');
    expect(dateInput).toBeInTheDocument();

    // 金額フィールドに 50000 がプリフィルされていること。
    const amountInput = within(panel).getByDisplayValue('50000');
    expect(amountInput).toBeInTheDocument();

    // カテゴリフィールドに '交通費' が表示されていること（MUI Select の表示テキストで確認）。
    expect(within(panel).getByText('交通費')).toBeInTheDocument();

    // 摘要フィールドに '新幹線代' がプリフィルされていること。
    const descriptionInput = within(panel).getByDisplayValue('新幹線代');
    expect(descriptionInput).toBeInTheDocument();
  });

  // RPT-FE-090-B: 別明細クリック時にパネルが切り替わり、それぞれのプリフィル値が正しく表示される。
  // （090: handleItemClick を連続で呼んでも formKey インクリメントで再マウントされ正しくプリフィルされること）
  it('RPT-FE-090-B: 2件の明細を連続クリックすると、それぞれの明細の値がパネルにプリフィルされる', async () => {
    const user = userEvent.setup();

    // 2件の明細を持つレポートデータ。
    const twoItemsReport = {
      ...mockDraftReportDetail,
      items: [
        {
          id: 'item-001',
          report_id: 'test-report-id',
          expense_date: '2026-03-10',
          amount: 50000,
          category: { id: 'cat-001', code: 'TRANSPORT', name_ja: '交通費', sort_order: 1 },
          description: '新幹線代',
          attachments: [],
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
        },
        {
          id: 'item-002',
          report_id: 'test-report-id',
          expense_date: '2026-03-11',
          amount: 3000,
          category: { id: 'cat-002', code: 'FOOD', name_ja: '食費', sort_order: 2 },
          description: '昼食代',
          attachments: [],
          created_at: '2026-03-02T00:00:00Z',
          updated_at: '2026-03-02T00:00:00Z',
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: twoItemsReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 1件目（item-001）をクリックしてパネルを開く。
    await user.click(screen.getByTestId('item-row-item-001'));
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // 1件目クリック後: item-001 の値がプリフィルされていること。
    const panel1 = screen.getByTestId('item-slide-panel');
    expect(within(panel1).getByDisplayValue('2026-03-10')).toBeInTheDocument();
    expect(within(panel1).getByDisplayValue('50000')).toBeInTheDocument();
    expect(within(panel1).getByText('交通費')).toBeInTheDocument();
    expect(within(panel1).getByDisplayValue('新幹線代')).toBeInTheDocument();

    // 2件目（item-002）をクリックして別明細に切り替える（formKey がインクリメントされ再マウントされる）。
    await user.click(screen.getByTestId('item-row-item-002'));
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // 2件目クリック後: item-002 の値に切り替わっていること（item-001 の値は表示されない）。
    const panel2 = screen.getByTestId('item-slide-panel');
    expect(within(panel2).getByDisplayValue('2026-03-11')).toBeInTheDocument();
    expect(within(panel2).getByDisplayValue('3000')).toBeInTheDocument();
    expect(within(panel2).getByText('食費')).toBeInTheDocument();
    expect(within(panel2).getByDisplayValue('昼食代')).toBeInTheDocument();
    // item-001 の値は表示されないこと（プリフィルの切り替えを検証）。
    expect(within(panel2).queryByDisplayValue('新幹線代')).not.toBeInTheDocument();
  });

  // RPT-FE-090-C: 編集ボタン（handleEditItem 経路）押下時にも対象明細の値がプリフィルされる。
  // （090: handleEditItem 経路のテストが欠落していた codex 指摘への対応）
  it('RPT-FE-090-C: 明細の編集ボタン押下で ItemSlidePanel が表示され、フォームに対象明細の値がプリフィルされる', async () => {
    const user = userEvent.setup();

    // 編集ボタンは canEditItems=true（isOwner=true かつ status='draft'）の場合のみ表示される。
    // mockCurrentUser.id と mockDraftReportDetail.submitter.id は共に 'current-user-id' のため isOwner=true になる。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 「編集」ボタンをクリックする。
    // ItemTable の編集ボタン（canEditItems=true 時のみ表示）をクリックする。
    // ReportActionBar にも「編集」ボタンが存在するため、item-row 内に絞り込んで取得する。
    const itemRow = screen.getByTestId('item-row-item-001');
    const editButton = within(itemRow).getByRole('button', { name: /編集/ });
    await user.click(editButton);

    // ItemSlidePanel が表示されること。
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // パネル内のフォームに対象明細（item-001）の値がプリフィルされていること。
    // handleEditItem 経路でも formKey インクリメントによる再マウントが実施される。
    const panel = screen.getByTestId('item-slide-panel');

    // 日付フィールドに '2026-03-10' がプリフィルされていること。
    expect(within(panel).getByDisplayValue('2026-03-10')).toBeInTheDocument();

    // 金額フィールドに 50000 がプリフィルされていること。
    expect(within(panel).getByDisplayValue('50000')).toBeInTheDocument();

    // カテゴリフィールドに '交通費' が表示されていること（MUI Select の表示テキストで確認）。
    expect(within(panel).getByText('交通費')).toBeInTheDocument();

    // 摘要フィールドに '新幹線代' がプリフィルされていること。
    expect(within(panel).getByDisplayValue('新幹線代')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // G-C01: 承認確認ダイアログ
  // -------------------------------------------------------------------------

  // WFL-FE-063-D: 承認ボタン押下で ConfirmDialog が表示され、「承認コメント」TextField が存在する
  it('WFL-FE-063-D: 承認ボタン押下で ConfirmDialog が表示され、「承認コメント」TextField が存在する', async () => {
    const user = userEvent.setup();

    // Approver ロールで submitted ステータスのレポートを設定する。
    const approverUser = {
      ...mockCurrentUser,
      id: 'approver-user-id',
      role: 'approver' as const,
    };
    const submittedReport = {
      ...mockDraftReportDetail,
      status: 'submitted' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: approverUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: submittedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 承認ボタンをクリックする。
    const approveButton = screen.getByRole('button', { name: '承認' });
    await user.click(approveButton);

    // ConfirmDialog が表示されること。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // 「承認コメント」TextField が存在すること。
    expect(screen.getByLabelText(/承認コメント/)).toBeInTheDocument();
  });

  // WFL-FE-063-E: ConfirmDialog のコメント入力 + 「承認する」押下で useApproveReport.mutate が呼ばれる
  it('WFL-FE-063-E: コメント入力後に「承認する」押下で useApproveReport.mutate が呼ばれる', async () => {
    const user = userEvent.setup();

    // Approver ロールで submitted ステータスのレポートを設定する。
    const approverUser = {
      ...mockCurrentUser,
      id: 'approver-user-id',
      role: 'approver' as const,
    };
    const submittedReport = {
      ...mockDraftReportDetail,
      status: 'submitted' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    const approveMutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseApproveReport.mockReturnValue({ mutate: approveMutate, isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: approverUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: submittedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 承認ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '承認' }));

    // ConfirmDialog が表示されるまで待つ。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // 「承認コメント」TextField にコメントを入力する。
    const commentField = screen.getByLabelText(/承認コメント/);
    await user.type(commentField, '問題ありません');

    // 「承認する」ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '承認する' }));

    // useApproveReport.mutate が呼ばれること。
    await waitFor(() => {
      expect(approveMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-report-id', comment: '問題ありません' }),
        expect.any(Object),
      );
    });
  });

  // WFL-FE-063-F: ConfirmDialog の「キャンセル」でダイアログが閉じミューテーション未実行
  it('WFL-FE-063-F: 承認ダイアログのキャンセルでダイアログが閉じミューテーションが未実行', async () => {
    const user = userEvent.setup();

    const approverUser = {
      ...mockCurrentUser,
      id: 'approver-user-id',
      role: 'approver' as const,
    };
    const submittedReport = {
      ...mockDraftReportDetail,
      status: 'submitted' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    const approveMutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseApproveReport.mockReturnValue({ mutate: approveMutate, isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: approverUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: submittedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 承認ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '承認' }));

    // ConfirmDialog が表示されるまで待つ。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // 「キャンセル」ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    // ダイアログが閉じること。
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // useApproveReport.mutate が呼ばれていないこと。
    expect(approveMutate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // G-C02: 却下確認ダイアログ
  // -------------------------------------------------------------------------

  // WFL-FE-064-D: 却下ボタン押下で ConfirmDialog が表示され、「却下理由」TextField(required) が存在する
  it('WFL-FE-064-D: 却下ボタン押下で ConfirmDialog が表示され、「却下理由」TextField が存在する', async () => {
    const user = userEvent.setup();

    const approverUser = {
      ...mockCurrentUser,
      id: 'approver-user-id',
      role: 'approver' as const,
    };
    const submittedReport = {
      ...mockDraftReportDetail,
      status: 'submitted' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: approverUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: submittedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 却下ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '却下' }));

    // ConfirmDialog が表示されること。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // 「却下理由」TextField が存在すること。
    const reasonField = screen.getByLabelText(/却下理由/);
    expect(reasonField).toBeInTheDocument();
    // required 属性が設定されていること。
    expect(reasonField).toBeRequired();
  });

  // WFL-FE-064-E: 却下理由未入力時は「却下する」ボタンが disabled である
  it('WFL-FE-064-E: 却下理由未入力時は「却下する」ボタンが disabled である', async () => {
    const user = userEvent.setup();

    const approverUser = {
      ...mockCurrentUser,
      id: 'approver-user-id',
      role: 'approver' as const,
    };
    const submittedReport = {
      ...mockDraftReportDetail,
      status: 'submitted' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: approverUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: submittedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 却下ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '却下' }));

    // ConfirmDialog が表示されるまで待つ。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // 却下理由が未入力の場合、「却下する」ボタンが disabled であること。
    // ConfirmDialog の isConfirmDisabled ロジック: required=true && inputValue.trim() === ''
    expect(screen.getByRole('button', { name: '却下する' })).toBeDisabled();
  });

  // WFL-FE-064-F: 却下理由入力 + 「却下する」押下で useRejectReport.mutate が reason 付きで呼ばれる
  it('WFL-FE-064-F: 却下理由入力後に「却下する」押下で useRejectReport.mutate が reason 付きで呼ばれる', async () => {
    const user = userEvent.setup();

    const approverUser = {
      ...mockCurrentUser,
      id: 'approver-user-id',
      role: 'approver' as const,
    };
    const submittedReport = {
      ...mockDraftReportDetail,
      status: 'submitted' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    const rejectMutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseRejectReport.mockReturnValue({ mutate: rejectMutate, isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: approverUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: submittedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 却下ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '却下' }));

    // ConfirmDialog が表示されるまで待つ。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // 「却下理由」TextField に理由を入力する。
    await user.type(screen.getByLabelText(/却下理由/), '経費の内容が不適切です');

    // 「却下する」ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '却下する' }));

    // useRejectReport.mutate が reason 付きで呼ばれること。
    await waitFor(() => {
      expect(rejectMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-report-id', reason: '経費の内容が不適切です' }),
        expect.any(Object),
      );
    });
  });

  // WFL-FE-064-G: ConfirmDialog の「キャンセル」でダイアログが閉じミューテーション未実行
  it('WFL-FE-064-G: 却下ダイアログのキャンセルでダイアログが閉じミューテーションが未実行', async () => {
    const user = userEvent.setup();

    const approverUser = {
      ...mockCurrentUser,
      id: 'approver-user-id',
      role: 'approver' as const,
    };
    const submittedReport = {
      ...mockDraftReportDetail,
      status: 'submitted' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    const rejectMutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseRejectReport.mockReturnValue({ mutate: rejectMutate, isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: approverUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: submittedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 却下ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '却下' }));

    // ConfirmDialog が表示されるまで待つ。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // 「キャンセル」ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    // ダイアログが閉じること。
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // useRejectReport.mutate が呼ばれていないこと。
    expect(rejectMutate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // G-C03: 支払完了確認ダイアログ
  // -------------------------------------------------------------------------

  // WFL-FE-065-D: 支払完了ボタン押下で ConfirmDialog が表示される
  it('WFL-FE-065-D: 支払完了ボタン押下で ConfirmDialog が表示される', async () => {
    const user = userEvent.setup();

    // Accounting ロールで approved ステータスのレポートを設定する。
    const accountingUser = {
      ...mockCurrentUser,
      id: 'accounting-user-id',
      role: 'accounting' as const,
    };
    const approvedReport = {
      ...mockDraftReportDetail,
      status: 'approved' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: accountingUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: approvedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 支払完了ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '支払完了' }));

    // ConfirmDialog が表示されること。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // WFL-FE-065-E: ConfirmDialog の「支払完了にする」押下で useMarkAsPaid.mutate が呼ばれる
  it('WFL-FE-065-E: 「支払完了にする」押下で useMarkAsPaid.mutate が呼ばれる', async () => {
    const user = userEvent.setup();

    const accountingUser = {
      ...mockCurrentUser,
      id: 'accounting-user-id',
      role: 'accounting' as const,
    };
    const approvedReport = {
      ...mockDraftReportDetail,
      status: 'approved' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    const payMutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseMarkAsPaid.mockReturnValue({ mutate: payMutate, isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: accountingUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: approvedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 支払完了ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '支払完了' }));

    // ConfirmDialog が表示されるまで待つ。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // 「支払完了にする」ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '支払完了にする' }));

    // useMarkAsPaid.mutate が呼ばれること。
    await waitFor(() => {
      expect(payMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-report-id' }),
        expect.any(Object),
      );
    });
  });

  // WFL-FE-065-F: ConfirmDialog の「キャンセル」でダイアログが閉じミューテーション未実行
  it('WFL-FE-065-F: 支払完了ダイアログのキャンセルでダイアログが閉じミューテーションが未実行', async () => {
    const user = userEvent.setup();

    const accountingUser = {
      ...mockCurrentUser,
      id: 'accounting-user-id',
      role: 'accounting' as const,
    };
    const approvedReport = {
      ...mockDraftReportDetail,
      status: 'approved' as const,
      submitter: { id: 'other-user-id', name: '申請者太郎' },
    };

    const payMutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseMarkAsPaid.mockReturnValue({ mutate: payMutate, isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: accountingUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: approvedReport }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 支払完了ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: '支払完了' }));

    // ConfirmDialog が表示されるまで待つ。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // 「キャンセル」ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    // ダイアログが閉じること。
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // useMarkAsPaid.mutate が呼ばれていないこと。
    expect(payMutate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // issue-126: location.state.toast 受信テスト
  // -------------------------------------------------------------------------

  // issue-126-A: ReportCreatePage / ReportEditPage からの遷移時に location.state.toast を受け取りトーストを表示する。
  it('issue-126-A: location.state.toast を受け取ると既存の setToast state にトーストが表示される', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    // location.state に toast を持たせてレンダリングする（ReportCreatePage の成功遷移を模倣）。
    renderPage('test-report-id', undefined, {
      toast: { severity: 'success', message: 'レポートを作成しました' },
    });

    // AppToast が severity=success・メッセージ付きで表示されること。
    await waitFor(() => {
      const toastEl = screen.getByTestId('app-toast');
      expect(toastEl).toBeInTheDocument();
      expect(toastEl).toHaveAttribute('data-severity', 'success');
      expect(toastEl).toHaveTextContent('レポートを作成しました');
    });
  });

  // issue-126-B: location.state に toast がない場合はトーストが表示されない。
  it('issue-126-B: location.state に toast がない場合はトーストが表示されない', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    // location.state なしでレンダリングする（通常のナビゲーション）。
    renderPage('test-report-id');

    // AppToast は非表示（open=false）のため data-testid='app-toast' は DOM に存在しない。
    // AppToast コンポーネントの実装上、open=false のとき aria-hidden または DOM から除外される。
    // ここでは「表示されていないこと」を確認する。
    // open=false の AppToast は DOM に存在しないか hidden になるため queryByTestId で確認する。
    const toastEl = screen.queryByTestId('app-toast');
    if (toastEl) {
      // DOM に存在する場合は open=false（aria-hidden 等）であること。
      expect(toastEl).not.toHaveAttribute('role', 'alert');
    }
    // toast が open=false のときはユーザーに見えないことを確認する（テキストが表示されない）。
    expect(screen.queryByText('レポートを作成しました')).not.toBeInTheDocument();
    expect(screen.queryByText('レポートを更新しました')).not.toBeInTheDocument();
  });
});

// =============================================================================
// issue #134 回帰テスト: handleActionError が err.message ベースのメッセージを表示すること
// =============================================================================

describe('ReportDetailPage エラーハンドリング回帰テスト（issue #134）', () => {
  const mockCategories = [
    { id: 'cat-001', code: 'TRANSPORT', name_ja: '交通費', sort_order: 1 },
  ];

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCategories.mockReturnValue({ data: mockCategories, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreateItem.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseUpdateItem.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteItem.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseApproveReport.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseRejectReport.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseMarkAsPaid.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // issue #134: 提出操作で 403 エラーが返ったとき、SERVER_ERROR_MESSAGES.FORBIDDEN の文言がトーストに表示される。
  // 修正前: handleActionError が 403 のハードコード文言を使っていた。
  // 修正後: err.message（client.ts 層でマッピング済み）をそのまま使う。
  it('issue #134: 提出で 403 エラー時に err.message（SERVER_ERROR_MESSAGES.FORBIDDEN）がトーストに表示される', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    // useSubmitReport.mutate が 403 ApiClientError を onError でコールする。
    // client.ts 層は FORBIDDEN コードを SERVER_ERROR_MESSAGES.FORBIDDEN にマッピングするため、
    // err.message は 'この操作を行う権限がありません。' になる。
    const { ApiClientError: ActualApiClientError } = await import('../../../api/client');
    const forbiddenError = new ActualApiClientError(
      'この操作を行う権限がありません。',
      403,
      'FORBIDDEN',
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submitMutate = vi.fn().mockImplementation((_data: unknown, options?: any) => {
      options?.onError?.(forbiddenError);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: submitMutate, isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 提出ボタンをクリックして確認ダイアログを開く。
    const submitButton = screen.getByRole('button', { name: /提出/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // ダイアログで「はい」を押す。
    await user.click(screen.getByRole('button', { name: /はい/ }));

    // err.message（SERVER_ERROR_MESSAGES.FORBIDDEN）がトーストに表示されること。
    await waitFor(() => {
      expect(screen.getByTestId('app-toast')).toHaveTextContent('この操作を行う権限がありません。');
    });
  });

  // issue #134: 明細削除で API エラー時に err.message がパネルのエラーエリアに表示される。
  // 修正前: onError: () => setItemApiError('明細の削除に失敗しました') （err を受け取らない）
  // 修正後: onError: (err) => { const message = err instanceof Error ? err.message : '...'; setItemApiError(message); }
  it('issue #134: 明細削除で FORBIDDEN エラー時に err.message（SERVER_ERROR_MESSAGES.FORBIDDEN）が表示される', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    const { ApiClientError: ActualApiClientError } = await import('../../../api/client');
    const forbiddenError = new ActualApiClientError(
      'この操作を行う権限がありません。',
      403,
      'FORBIDDEN',
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteItemMutate = vi.fn().mockImplementation((_data: unknown, options?: any) => {
      options?.onError?.(forbiddenError);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteItem.mockReturnValue({ mutate: deleteItemMutate, isPending: false } as any);

    renderPage('test-report-id');

    // 明細削除ボタンをクリックする（レポート削除ボタンより後の削除ボタン）。
    const allDeleteButtons = screen.getAllByRole('button', { name: /削除/ });
    // item-row 内の削除ボタンを探す。
    const itemDeleteButton = allDeleteButtons.find((btn) => {
      const itemRow = screen.queryByTestId('item-row-item-001');
      return itemRow?.contains(btn);
    });
    expect(itemDeleteButton).toBeDefined();
    await user.click(itemDeleteButton!);

    // 確認ダイアログで「はい」を押す。
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /はい/ }));

    // err.message（SERVER_ERROR_MESSAGES.FORBIDDEN）がエラー表示に現れること。
    await waitFor(() => {
      expect(screen.getByText('この操作を行う権限がありません。')).toBeInTheDocument();
    });
  });
});
