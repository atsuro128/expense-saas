// ReportEditPage のユニットテスト。
// RPT-FE-050〜057 に対応する。
// report-edit.md の ReportEditPage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportEditPage from '../ReportEditPage';

function renderPage(reportId = 'test-report-id') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/reports/${reportId}/edit`]}>
        <Routes>
          <Route path="/reports/:id/edit" element={<ReportEditPage />} />
          <Route path="/reports" element={<div>reports-list</div>} />
          <Route path="/reports/:id" element={<div>reports-detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportEditPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // RPT-FE-050: useReport が既存データを返すとき ReportForm にタイトル入力欄が表示される
  // （report-edit.md §ReportEditPage 責務: useReport で既存データを読み込み、フォームに反映）。
  it('RPT-FE-050: ReportForm（タイトル・対象期間の入力欄）が表示される', async () => {
    renderPage('cccccccc-0001-0001-0001-000000000001');
    // スタブ実装では ReportForm が存在しない。
    // 実装後はタイトル入力欄が表示される。
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /タイトル/ })).not.toBeNull();
    });
  });

  // RPT-FE-051: 「保存する」ボタンが表示される
  // （report-edit.md §ReportFormActions 責務: 保存ボタンを配置）。
  it('RPT-FE-051: 保存ボタン（保存する）が表示される', async () => {
    renderPage('test-report-id');
    // スタブ実装では ReportFormActions が存在しない。
    // 実装後は「保存する」ボタンが表示される。
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /保存する/ })).not.toBeNull();
    });
  });

  // RPT-FE-052: useReport が 404 を返すと /reports にリダイレクトされる
  // （report-edit.md §ReportEditPage 責務: レポートが存在しない場合は一覧にリダイレクト）。
  // レポートが存在しない場合は reports-list に遷移し、「reports-list」テキストが表示される。
  it('RPT-FE-052: 存在しないレポート ID で /reports にリダイレクトされる', async () => {
    renderPage('00000000-0000-0000-0000-000000000099');
    // スタブ実装ではリダイレクト処理が存在しない。
    // 実装後は reports-list が表示される。
    await waitFor(() => {
      expect(screen.queryByText('reports-list')).not.toBeNull();
    });
  });

  // RPT-FE-053: 所有者でない場合に AppToast でエラーが表示される
  // （report-edit.md §ReportEditPage 責務: 所有者でない場合は 403 トースト表示）。
  it('RPT-FE-053: 所有者でない場合にエラートーストが表示される', async () => {
    renderPage('other-user-report-id');
    // スタブ実装では権限チェックが行われない。
    // 実装後はエラートーストが表示される。
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeNull();
    });
  });

  // RPT-FE-054: レポートが draft 以外（submitted 等）のとき /reports/:id にリダイレクトされる
  // （report-edit.md §ReportEditPage 責務: draft でない場合は詳細画面にリダイレクト）。
  it('RPT-FE-054: draft でないレポートで詳細画面にリダイレクトされる', async () => {
    renderPage('submitted-report-id');
    // スタブ実装では状態チェックが行われない。
    // 実装後は reports-detail が表示される。
    await waitFor(() => {
      expect(screen.queryByText('reports-detail')).not.toBeNull();
    });
  });

  // RPT-FE-055: データ読み込み中は PageSkeleton が表示される
  // （report-edit.md コンポーネントツリー: データ読み込み中は PageSkeleton 表示）。
  it('RPT-FE-055: データ読み込み中は PageSkeleton が表示される', () => {
    renderPage('test-report-id');
    // スタブ実装では PageSkeleton が使用されない。
    expect(screen.queryByTestId('page-skeleton')).not.toBeNull();
  });

  // RPT-FE-056: キャンセルボタンが表示される
  // （report-edit.md §ReportFormActions 責務: キャンセルボタンを配置）。
  it('RPT-FE-056: キャンセルボタンが表示される', async () => {
    renderPage('test-report-id');
    // スタブ実装では ReportFormActions が存在しない。
    // 実装後は「キャンセル」ボタンが表示される。
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /キャンセル/ })).not.toBeNull();
    });
  });

  // RPT-FE-057: AppBreadcrumbs がパンくずナビとして表示される
  // （report-edit.md コンポーネントツリー: AppBreadcrumbs を配置）。
  it('RPT-FE-057: AppBreadcrumbs がパンくずナビとして表示される', async () => {
    renderPage('test-report-id');
    // スタブ実装では AppBreadcrumbs が使用されない。
    // 実装後は navigation ロールのパンくずが表示される。
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeNull();
    });
  });
});
