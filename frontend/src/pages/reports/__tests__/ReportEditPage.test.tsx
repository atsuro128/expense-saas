// ReportEditPage のユニットテスト。
// RPT-FE-050〜057 に対応する。
// report-edit.md §ReportEditPage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import ReportEditPage from '../ReportEditPage';

// useReport / useUpdateReport / useCurrentUser Hook をモックする。
// スタブ実装段階では実際の Hook は存在しないため vi.mock でインターセプトする。
vi.mock('../../hooks/useReports', () => ({
  useReport: vi.fn(),
  useUpdateReport: vi.fn(),
}));

vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

// vi.mock 後に import することでモック済みの関数参照を取得する。
import { useReport, useUpdateReport } from '../../../hooks/useReports';
import { useCurrentUser } from '../../../hooks/useCurrentUser';

const mockUseReport = vi.mocked(useReport);
const mockUseUpdateReport = vi.mocked(useUpdateReport);
const mockUseCurrentUser = vi.mocked(useCurrentUser);

// テスト用の既存レポートデータ（draft 状態、Test Member 所有）。
const mockDraftReport = {
  id: 'test-report-id',
  title: '既存タイトル',
  period_start: '2026-03-01',
  period_end: '2026-03-31',
  status: 'draft' as const,
  total_amount: 50000,
  submitter: { id: 'current-user-id', name: 'テスト太郎' },
  items: [],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

// テスト用の現在ユーザー（所有者）。
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

function renderPage(reportId = 'test-report-id') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/reports/${reportId}/edit`]}>
        <Routes>
          <Route path="/reports/:id/edit" element={<ReportEditPage />} />
          <Route path="/reports" element={<div data-testid="reports-list">reports-list</div>} />
          <Route path="/reports/:id" element={<div data-testid="report-detail">report-detail</div>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportEditPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // RPT-FE-050: useReport が既存レポート（title: "既存タイトル", periodStart, periodEnd, status: "draft"）を返す
  // → ReportForm に defaultValues として既存データがプリフィルされる
  // （report-edit.md §ReportEditPage: useReport で既存データを読み込み、フォームの defaultValues に渡す）
  it('RPT-FE-050: useReport が既存データを返すと ReportForm に defaultValues がプリフィルされる', async () => {
    // 現在のユーザーを所有者として設定する。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // useReport が既存レポートデータを返すようにモックする。
    // スタブ実装では useReport が未実装のため失敗する。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReport }, isLoading: false, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseUpdateReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // ReportForm のタイトル入力欄に既存タイトルがプリフィルされること。
    // スタブ実装では useReport が未実装のため失敗する。
    await waitFor(() => {
      const titleInput = screen.getByRole('textbox', { name: /タイトル/ });
      expect((titleInput as HTMLInputElement).value).toBe('既存タイトル');
    });
  });

  // RPT-FE-051: フォームに有効な値を入力して送信。useUpdateReport が成功を返す
  // → /reports/:id に遷移する
  // （report-edit.md §ReportEditPage: 成功時に navigate('/reports/:id')）
  it('RPT-FE-051: フォーム送信成功後に /reports/:id に遷移する', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReport }, isLoading: false, isError: false, error: null } as any);

    // useUpdateReport が成功を返すようにモックする。
    // スタブ実装では useUpdateReport が未実装のため失敗する。
    mockUseUpdateReport.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mutate: vi.fn().mockImplementation((_data: unknown, options?: any) => { options?.onSuccess?.(); }),
      isPending: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('test-report-id');

    // タイトル入力欄に値を入力する（既存データがプリフィルされているが上書きする）。
    // スタブ実装では ReportForm が存在しないため失敗する。
    const titleInput = await screen.findByRole('textbox', { name: /タイトル/ });
    await user.clear(titleInput);
    await user.type(titleInput, '更新タイトル');

    // 開始日入力欄に値を入力する（ReportPeriodField の periodStart）。
    // AppDatePicker が name="periodStart" の input をレンダリングする。
    // スタブ実装では ReportForm / ReportPeriodField が存在しないため失敗する。
    const periodStartInput = document.querySelector('input[name="periodStart"]') as HTMLInputElement;
    await user.clear(periodStartInput);
    await user.type(periodStartInput, '2026-03-01');

    // 終了日入力欄に値を入力する（ReportPeriodField の periodEnd）。
    // AppDatePicker が name="periodEnd" の input をレンダリングする。
    // スタブ実装では ReportForm / ReportPeriodField が存在しないため失敗する。
    const periodEndInput = document.querySelector('input[name="periodEnd"]') as HTMLInputElement;
    await user.clear(periodEndInput);
    await user.type(periodEndInput, '2026-03-31');

    // 保存ボタンをクリックする。
    // スタブ実装では ReportFormActions が存在しないため失敗する。
    const submitButton = screen.getByRole('button', { name: /保存する/ });
    await user.click(submitButton);

    // /reports/test-report-id に遷移すること。
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/reports/test-report-id');
    });
  });

  // RPT-FE-052: useReport が 404 エラーを返す
  // → /reports にリダイレクトされトーストが表示される
  // （report-edit.md §ReportEditPage: レポートが存在しない場合は一覧にリダイレクト）
  it('RPT-FE-052: useReport が 404 を返すと /reports にリダイレクトされトーストが表示される', async () => {
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
    mockUseUpdateReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('non-existent-id');

    // /reports にリダイレクトされること。
    // スタブ実装ではリダイレクト処理が存在しないため失敗する。
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/reports');
    });

    // トーストが表示されること。
    expect(screen.getByTestId('app-toast')).toBeInTheDocument();
  });

  // RPT-FE-053: useReport がレポートを返す（submitter.id != currentUser.id）
  // → 403 トーストが表示される
  // （report-edit.md §ReportEditPage: 所有者でない場合は 403 トースト表示）
  it('RPT-FE-053: 所有者でないと 403 トーストが表示される', async () => {
    // 現在のユーザーは所有者ではない（別ユーザー ID）。
    const otherUser = { ...mockCurrentUser, id: 'other-user-id', name: '別ユーザー', email: 'other@example.com' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: otherUser }, isLoading: false } as any);

    // レポートの submitter.id は 'current-user-id'（現在のユーザーとは異なる）。
    mockUseReport.mockReturnValue({
      data: { data: { ...mockDraftReport, submitter: { id: 'current-user-id', name: 'テスト太郎' } } },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseUpdateReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // 403 トーストが表示されること。
    // スタブ実装では権限チェックが存在しないため失敗する。
    await waitFor(() => {
      expect(screen.getByTestId('app-toast')).toBeInTheDocument();
      expect(screen.getByTestId('app-toast')).toHaveAttribute('data-severity', 'error');
    });
  });

  // RPT-FE-054: useReport が status: "submitted" のレポートを返す
  // → /reports/:id にリダイレクトされトーストが表示される
  // （report-edit.md §ReportEditPage: draft でない場合は詳細画面にリダイレクト）
  it('RPT-FE-054: draft でないレポートは /reports/:id にリダイレクトされトーストが表示される', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // useReport が status="submitted" のレポートを返すようにモックする。
    mockUseReport.mockReturnValue({
      data: { data: { ...mockDraftReport, status: 'submitted' as const } },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseUpdateReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // /reports/test-report-id にリダイレクトされること。
    // スタブ実装では状態チェックが存在しないため失敗する。
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/reports/test-report-id');
    });

    // トーストが表示されること。
    expect(screen.getByTestId('app-toast')).toBeInTheDocument();
  });

  // RPT-FE-055: useUpdateReport が 409 CONFLICT を返す
  // → FormAlert に「他のユーザーがこのレポートを更新しました。ページを再読み込みしてください。」が表示される
  // （report-edit.md §ReportEditPage: 409 Conflict 時は FormAlert にエラーメッセージを表示）
  it('RPT-FE-055: useUpdateReport が 409 CONFLICT を返すと FormAlert に競合エラーが表示される', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReport }, isLoading: false, isError: false, error: null } as any);

    // useUpdateReport が 409 CONFLICT を返すようにモックする。
    const conflictError = Object.assign(new Error('Conflict'), { status: 409, code: 'CONFLICT' });
    mockUseUpdateReport.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mutate: vi.fn().mockImplementation((_data: unknown, options?: any) => { options?.onError?.(conflictError); }),
      isPending: false,
      isError: true,
      error: conflictError,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('test-report-id');

    // フォームを送信して 409 エラーを発生させる。
    // スタブ実装では ReportFormActions が存在しないため失敗する。
    const submitButton = screen.getByRole('button', { name: /保存する/ });
    await user.click(submitButton);

    // FormAlert に競合エラーメッセージが表示されること。
    // スタブ実装では FormAlert が存在しないため失敗する。
    await waitFor(() => {
      expect(screen.getByTestId('form-alert')).toBeInTheDocument();
      expect(screen.getByTestId('form-alert')).toHaveTextContent('他のユーザーがこのレポートを更新しました');
    });
  });

  // RPT-FE-056: キャンセルボタンをクリック
  // → /reports/:id に遷移する
  // （report-edit.md §ReportEditPage: onCancel で navigate('/reports/:id')）
  it('RPT-FE-056: キャンセルボタン押下で /reports/:id に遷移する', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReport }, isLoading: false, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseUpdateReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // キャンセルボタンをクリックする。
    // スタブ実装では ReportFormActions が存在しないため失敗する。
    const cancelButton = screen.getByRole('button', { name: /キャンセル/ });
    await user.click(cancelButton);

    // /reports/test-report-id に遷移すること。
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/reports/test-report-id');
    });
  });

  // RPT-FE-057: useReport の isLoading が true
  // → PageSkeleton（variant: 'form'）が表示される
  // （report-edit.md コンポーネントツリー: データ読み込み中は PageSkeleton 表示）
  it('RPT-FE-057: useReport isLoading=true のとき PageSkeleton（variant=form）が表示される', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);

    // useReport がローディング中の状態を返すようにモックする。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseUpdateReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);

    renderPage('test-report-id');

    // PageSkeleton が表示されること（variant='form'）。
    // スタブ実装では PageSkeleton が存在しないため失敗する。
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('page-skeleton')).toHaveAttribute('data-variant', 'form');
  });
});
