// ReportDetailPage のユニットテスト。
// RPT-FE-064〜069 に対応する。
// report-detail.md §ReportDetailPage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import ReportDetailPage from '../ReportDetailPage';

// useReport / useSubmitReport / useDeleteReport / useAuth Hook をモックする。
// スタブ実装段階では実際の Hook は存在しないため vi.mock でインターセプトする。
vi.mock('../../hooks/useReports', () => ({
  useReport: vi.fn(),
  useSubmitReport: vi.fn(),
  useDeleteReport: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// vi.mock 後に import することでモック済みの関数参照を取得する。
import { useReport, useSubmitReport, useDeleteReport } from '../../hooks/useReports';
import { useAuth } from '../../hooks/useAuth';

const mockUseReport = vi.mocked(useReport);
const mockUseSubmitReport = vi.mocked(useSubmitReport);
const mockUseDeleteReport = vi.mocked(useDeleteReport);
const mockUseAuth = vi.mocked(useAuth);

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // RPT-FE-064: useReport が draft 状態のレポート詳細データを返す
  // → ReportInfoCard, ReportActionBar が描画される
  // （report-detail.md §ReportDetailPage: レポートデータを読み込み子コンポーネントに伝播）
  it('RPT-FE-064: useReport がデータを返すと ReportInfoCard と ReportActionBar が描画される', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: mockCurrentUser } as any);

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
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: mockCurrentUser } as any);

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
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: mockCurrentUser } as any);

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
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: mockCurrentUser } as any);

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
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: mockCurrentUser } as any);

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
    // スタブ実装では OwnerActions が存在しないため失敗する。
    const deleteButton = screen.getByRole('button', { name: /削除/ });
    await user.click(deleteButton);

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
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: mockCurrentUser } as any);

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
});
