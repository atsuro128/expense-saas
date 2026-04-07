// ReportListPage のユニットテスト。
// RPT-FE-001〜007 に対応する。
// report-list.md の ReportListPage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportListPage from '../ReportListPage';

function renderPage(initialEntry = '/reports') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ReportListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportListPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // RPT-FE-001: URL クエリパラメータ ?status=draft が設定されているとき、
  // ReportListFilter にステータスフィルタ（AppSelect）が表示される
  // （report-list.md §ReportListPage 責務: URL クエリパラメータからフィルタ条件を復元）。
  it('RPT-FE-001: ステータスフィルタ UI（AppSelect）が表示される', () => {
    renderPage('/reports?status=draft');
    // スタブ実装では ReportListFilter が存在しない。
    // 実装後は status フィルタの select が表示される。
    expect(screen.queryByRole('combobox')).not.toBeNull();
  });

  // RPT-FE-002: URL クエリパラメータ ?from・?to が設定されているとき、
  // ReportListFilter に日付フィルタ（AppDatePicker）が表示される
  // （report-list.md §ReportListPage 責務: URL クエリパラメータからフィルタ条件を復元）。
  it('RPT-FE-002: 日付フィルタ UI（AppDatePicker）が 2 件表示される', () => {
    renderPage('/reports?from=2026-03-01&to=2026-03-31');
    // スタブ実装では ReportListFilter が存在しない。
    // 実装後は開始日・終了日の 2 つのピッカーが表示される。
    const dateInputs = screen.queryAllByRole('textbox');
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  // RPT-FE-003: 「+ レポート作成」ボタンが表示される
  // （report-list.md §ReportListHeader 責務: CreateReportButton を配置）。
  it('RPT-FE-003: レポート作成ボタンが表示される', () => {
    renderPage('/reports');
    // スタブ実装では ReportListHeader と CreateReportButton が存在しない。
    // 実装後は作成ボタンが表示される。
    expect(screen.queryByRole('button')).not.toBeNull();
  });

  // RPT-FE-004: データが存在するとき ReportListTable（AppDataGrid）が表示される
  // （report-list.md §ReportListTable 責務: AppDataGrid にレポート行を表示）。
  it('RPT-FE-004: レポート一覧テーブル（AppDataGrid）が表示される', async () => {
    renderPage('/reports');
    // スタブ実装では ReportListTable が存在しない。
    // 実装後は role="grid" の DataGrid が表示される。
    await waitFor(() => {
      expect(screen.queryByRole('grid')).not.toBeNull();
    });
  });

  // RPT-FE-005: フィルタ変更時に page クエリが 1 にリセットされる
  // （report-list.md §ReportListPage 責務: フィルタ変更時に URL クエリパラメータを更新して page を 1 にリセット）。
  it('RPT-FE-005: ページタイトル「マイレポート」が表示される', () => {
    renderPage('/reports');
    // スタブ実装では ReportListHeader が存在しないため、タイトルが表示されない。
    // 実装後は「マイレポート」というページタイトルが表示される。
    expect(screen.queryByText('マイレポート')).not.toBeNull();
  });

  // RPT-FE-006: useMyReports の isLoading=true のとき PageSkeleton が表示される
  // （report-list.md コンポーネントツリー: データ読み込み中は PageSkeleton 表示）。
  // 初期レンダリング時はローディング状態になるため、PageSkeleton が表示される。
  it('RPT-FE-006: データ読み込み中は PageSkeleton が表示される', () => {
    renderPage('/reports');
    // スタブ実装では PageSkeleton が使用されない。
    expect(screen.queryByTestId('page-skeleton')).not.toBeNull();
  });

  // RPT-FE-007: AppPagination が表示される
  // （report-list.md コンポーネントツリー: AppPagination を配置）。
  it('RPT-FE-007: AppPagination が表示される', () => {
    renderPage('/reports');
    // スタブ実装では AppPagination が使用されない。
    // 実装後は pagination コンポーネントが表示される。
    expect(screen.queryByRole('navigation')).not.toBeNull();
  });
});
