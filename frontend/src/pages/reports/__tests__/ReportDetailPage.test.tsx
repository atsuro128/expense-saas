// ReportDetailPage のユニットテスト。
// RPT-FE-064〜069 に対応する。
// report-detail.md §ReportDetailPage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor, within, act } from '@testing-library/react';
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

// vi.mock 後に import することでモック済みの関数参照を取得する。
import { useReport, useSubmitReport, useDeleteReport } from '../../../hooks/useReports';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useCategories } from '../../../hooks/useCategories';
import { useCreateItem, useUpdateItem, useDeleteItem } from '../../../hooks/useItems';

const mockUseReport = vi.mocked(useReport);
const mockUseSubmitReport = vi.mocked(useSubmitReport);
const mockUseDeleteReport = vi.mocked(useDeleteReport);
const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUseCategories = vi.mocked(useCategories);
const mockUseCreateItem = vi.mocked(useCreateItem);
const mockUseUpdateItem = vi.mocked(useUpdateItem);
const mockUseDeleteItem = vi.mocked(useDeleteItem);

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

function renderPage(reportId = 'test-report-id', queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/reports/${reportId}`]}>
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

  // ITM-FE-098-3b: 明細行クリック時、パネルが一度 'closed' を経由してから再度開く（W1 テスト強化）。
  // handleItemClick / handleEditItem が setPanelState('closed'); setTimeout(() => setPanelState('view'), 0)
  // パターンを使っていることを検証し、このパターンが削除されたら失敗するテストを担保する。
  //
  // 検証方法: fireEvent（同期クリック）+ act() で状態を確定させ、
  // setTimeout(0) が発火する前の「closed」状態を捕捉する。
  // setTimeout が除去されて直接 setPanelState('view') になると closed 状態を経由しないため失敗する。
  it('ITM-FE-098-3b: 編集中に別の明細行をクリックすると、パネルが一度閉じてから再度開く', async () => {
    // fireEvent を使う（同期的なクリック）ために @testing-library/react からインポート。
    const { fireEvent } = await import('@testing-library/react');

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
    // handleItemClick は setTimeout(0) パターンを使うため、waitFor で最終的に表示されることを確認する。
    const itemRow1 = screen.getByTestId('item-row-item-001');
    act(() => {
      fireEvent.click(itemRow1);
    });

    // setTimeout(0) が発火するまで待つ（real timers なので waitFor が解決する）。
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // fake timers を有効化して 2件目クリック時の setTimeout を制御する。
    // ここで有効化することで、最初の waitFor には影響しない。
    vi.useFakeTimers();

    try {
      // 2件目の明細行をクリックする（同期的な fireEvent で setTimeout 発火前の状態を捕捉可能にする）。
      // handleItemClick は setPanelState('closed'); setTimeout(() => setPanelState('view'), 0) を実行する。
      act(() => {
        const itemRow2 = screen.getByTestId('item-row-item-002');
        fireEvent.click(itemRow2);
      });

      // act(fireEvent.click) 後: setPanelState('closed') が適用され Drawer が閉じている。
      // setTimeout はまだ pending なので panelState === 'closed' のまま。
      // MUI Drawer は open=false のとき Paper を DOM から除去する。
      // もし setTimeout が除去されて直接 setPanelState('view') になると、
      // パネルが closed を経由せず、このアサートが失敗する（パネルが常に表示されたまま）。
      expect(screen.queryByTestId('item-slide-panel')).not.toBeInTheDocument();

      // fake timers を進めて setTimeout(fn, 0) を解放し、setPanelState('view') を実行させる。
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // setTimeout(0) 実行後: panelState === 'view' でパネルが再表示されること。
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    } finally {
      // fake timers を必ず元に戻す（他のテストへの影響を防ぐ）。
      vi.useRealTimers();
    }
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
});
