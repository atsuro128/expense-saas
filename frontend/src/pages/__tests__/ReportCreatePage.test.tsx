// ReportCreatePage のユニットテスト。
// RPT-FE-024〜027 に対応する。
// report-create.md の ReportCreatePage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportCreatePage from '../ReportCreatePage';

function renderPage(initialEntry = '/reports/new') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reports/new" element={<ReportCreatePage />} />
          <Route path="/reports" element={<div>reports-list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportCreatePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // RPT-FE-024: タイトル入力フィールドと期間入力フィールドが表示される
  // （report-create.md §ReportForm 責務: title と period_start/period_end を入力）。
  it('RPT-FE-024: ReportForm（タイトル・対象期間の入力欄）が表示される', () => {
    renderPage('/reports/new');
    // スタブ実装では ReportForm が存在しない。
    // 実装後はタイトル入力欄が表示される。
    expect(screen.queryByRole('textbox', { name: /タイトル/ })).not.toBeNull();
  });

  // RPT-FE-025: 「作成する」送信ボタンが表示される
  // （report-create.md §ReportFormActions 責務: 送信ボタンを配置）。
  it('RPT-FE-025: 送信ボタン（作成する）が表示される', () => {
    renderPage('/reports/new');
    // スタブ実装では ReportFormActions が存在しない。
    // 実装後は「作成する」ボタンが表示される。
    expect(screen.queryByRole('button', { name: /作成する/ })).not.toBeNull();
  });

  // RPT-FE-026: URL クエリパラメータ ?ref=:id が存在するとき、
  // 元レポートのデータを useReport で取得してフォームにプリフィルする
  // （report-create.md §ReportCreatePage 責務: ?ref=:id の存在を確認し元レポートデータをプリフィル）。
  // ?ref 指定時はブレッドクラムに「再申請」の表示が含まれる。
  it('RPT-FE-026: ?ref クエリパラメータが存在するとき再申請フローの UI が表示される', async () => {
    const rejectedReportId = 'cccccccc-0004-0004-0004-000000000004';
    renderPage(`/reports/new?ref=${rejectedReportId}`);
    // スタブ実装では再申請フローの分岐がない。
    // 実装後は「再申請」を示す UI（タイトルやパンくず）が表示される。
    await waitFor(() => {
      expect(screen.queryByText(/再申請/)).not.toBeNull();
    });
  });

  // RPT-FE-027: 「キャンセル」ボタンが表示される
  // （report-create.md §ReportFormActions 責務: キャンセルボタンを配置）。
  it('RPT-FE-027: キャンセルボタンが表示される', () => {
    renderPage('/reports/new');
    // スタブ実装では ReportFormActions が存在しない。
    // 実装後は「キャンセル」ボタンが表示される。
    expect(screen.queryByRole('button', { name: /キャンセル/ })).not.toBeNull();
  });
});
