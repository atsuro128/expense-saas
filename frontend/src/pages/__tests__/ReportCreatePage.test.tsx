// ReportCreatePage のユニットテスト。
// RPT-FE-024〜027 に対応する。
// report-create.md §ReportCreatePage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import ReportCreatePage from '../ReportCreatePage';

// useCreateReport / useReport Hook をモックする。
// スタブ実装段階では実際の Hook は存在しないため vi.mock でインターセプトする。
vi.mock('../../hooks/useReports', () => ({
  useCreateReport: vi.fn(),
  useReport: vi.fn(),
}));

// vi.mock 後に import することでモック済みの関数参照を取得する。
import { useCreateReport, useReport } from '../../hooks/useReports';

const mockUseCreateReport = vi.mocked(useCreateReport);
const mockUseReport = vi.mocked(useReport);

// ルーティングによる遷移先を検証するためのヘルパーコンポーネント。
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage(initialEntry = '/reports/new') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reports/new" element={<ReportCreatePage />} />
          <Route path="/reports" element={<div data-testid="reports-list">reports-list</div>} />
          <Route path="/reports/:id" element={<div data-testid="report-detail">report-detail</div>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportCreatePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // RPT-FE-024: フォームに有効な値を入力して送信。useCreateReport が成功（id: "new-id-001"）を返す
  // → /reports/new-id-001 に遷移する
  // （report-create.md §ReportCreatePage: 成功時に navigate('/reports/:id')）
  it('RPT-FE-024: フォーム送信成功後に /reports/:id に遷移する', async () => {
    const user = userEvent.setup();

    // useCreateReport が成功を返すようにモックする。
    // mutate 呼び出し時に成功コールバックが実行され id="new-id-001" のレポートが返る。
    // スタブ実装では useCreateReport が未実装のため失敗する。
    mockUseCreateReport.mockReturnValue({
      mutate: vi.fn().mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_data: unknown, options?: any) => {
          options?.onSuccess?.({ id: 'new-id-001' });
        },
      ),
      isPending: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    mockUseReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports/new');

    // タイトル入力欄に値を入力する。
    // スタブ実装では ReportForm が存在しないため失敗する。
    const titleInput = screen.getByRole('textbox', { name: /タイトル/ });
    await user.clear(titleInput);
    await user.type(titleInput, '出張費 3月');

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

    // 送信ボタンをクリックする。
    const submitButton = screen.getByRole('button', { name: /作成する/ });
    await user.click(submitButton);

    // /reports/new-id-001 に遷移すること。
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/reports/new-id-001');
    });
  });

  // RPT-FE-025: useCreateReport がサーバーエラーを返す
  // → ReportForm に apiError が渡され FormAlert にエラーメッセージが表示される
  // （report-create.md §ReportCreatePage: エラー時は FormAlert にエラーメッセージを渡す）
  it('RPT-FE-025: useCreateReport がエラーを返すと FormAlert にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    // useCreateReport がエラーを返すようにモックする。
    // onError コールバックを呼び出してエラーをシミュレートする。
    // スタブ実装では useCreateReport が未実装のため失敗する。
    mockUseCreateReport.mockReturnValue({
      mutate: vi.fn().mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_data: unknown, options?: any) => {
          options?.onError?.(new Error('サーバーエラーが発生しました'));
        },
      ),
      isPending: false,
      isError: true,
      error: new Error('サーバーエラーが発生しました'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    mockUseReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports/new');

    // 送信操作を行ってエラーを発生させる。
    const titleInput = screen.getByRole('textbox', { name: /タイトル/ });
    await user.clear(titleInput);
    await user.type(titleInput, '出張費 3月');

    // 開始日・終了日を入力する（periodStart/periodEnd の min(1) バリデーション通過に必要）。
    const periodStartInput = document.querySelector('input[name="periodStart"]') as HTMLInputElement;
    await user.clear(periodStartInput);
    await user.type(periodStartInput, '2026-03-01');
    const periodEndInput = document.querySelector('input[name="periodEnd"]') as HTMLInputElement;
    await user.clear(periodEndInput);
    await user.type(periodEndInput, '2026-03-31');

    const submitButton = screen.getByRole('button', { name: /作成する/ });
    await user.click(submitButton);

    // FormAlert にエラーメッセージが表示されること。
    // スタブ実装では FormAlert が存在しないため失敗する。
    await waitFor(() => {
      expect(screen.getByTestId('form-alert')).toBeInTheDocument();
      expect(screen.getByTestId('form-alert')).toHaveTextContent('サーバーエラーが発生しました');
    });
  });

  // RPT-FE-026: URL パラメータ ?ref=rejected-report-id。useReport が元レポートデータを返す
  // → ReportForm の defaultValues に元レポートのデータがプリフィルされる
  // （report-create.md §ReportCreatePage: ?ref=:id の存在を確認し元レポートデータをプリフィル）
  it('RPT-FE-026: ?ref パラメータがあると useReport で取得した元レポートデータがフォームにプリフィルされる', async () => {
    const rejectedReportId = 'cccccccc-0004-0004-0004-000000000004';

    mockUseCreateReport.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // useReport が元レポートデータを返すようにモックする。
    // スタブ実装では useReport が未実装のため失敗する。
    mockUseReport.mockReturnValue({
      data: {
        data: {
          id: rejectedReportId,
          title: '元レポートタイトル',
          period_start: '2026-03-01',
          period_end: '2026-03-31',
          status: 'rejected',
          total_amount: 50000,
          submitter: { id: 'user-001', name: 'テスト太郎' },
          items: [],
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage(`/reports/new?ref=${rejectedReportId}`);

    // フォームのタイトル入力欄に元レポートのタイトルがプリフィルされること。
    // スタブ実装では元レポートデータのプリフィルが存在しないため失敗する。
    await waitFor(() => {
      const titleInput = screen.getByRole('textbox', { name: /タイトル/ });
      expect((titleInput as HTMLInputElement).value).toBe('元レポートタイトル');
    });
  });

  // RPT-FE-027: キャンセルボタンをクリック
  // → /reports に遷移する
  // （report-create.md §ReportCreatePage: onCancel で navigate('/reports')）
  it('RPT-FE-027: キャンセルボタン押下で /reports に遷移する', async () => {
    const user = userEvent.setup();

    mockUseCreateReport.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    mockUseReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderPage('/reports/new');

    // キャンセルボタンをクリックする。
    // スタブ実装では ReportFormActions が存在しないため失敗する。
    const cancelButton = screen.getByRole('button', { name: /キャンセル/ });
    await user.click(cancelButton);

    // /reports に遷移すること。
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/reports');
    });
  });
});
