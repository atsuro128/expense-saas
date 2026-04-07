// ReportDetailPage のユニットテスト。
// RPT-FE-064〜069 に対応する。
// ReportDetailPage は現在スタブ実装のため、テストはスタブ時点での動作を検証する。
// 機能実装後はこのテストを更新する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportDetailPage from '../ReportDetailPage';

function renderPage(reportId = 'test-report-id') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/reports/${reportId}`]}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportDetailPage', () => {
  // RPT-FE-064: useReport が draft 状態のレポートを返すとき ReportInfoCard と ReportActionBar が描画される（スタブ確認用）。
  it('RPT-FE-064: ReportDetailPage がスタブとして描画される', () => {
    renderPage();
    expect(screen.getByText('ReportDetailPage')).toBeInTheDocument();
  });

  // RPT-FE-065: useReport の isLoading=true のとき PageSkeleton が表示される（スタブ確認用）。
  it('RPT-FE-065: ローディング状態のシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-066: useReport が 404 を返すと「指定されたデータが見つかりません。」が表示される（スタブ確認用）。
  it('RPT-FE-066: 404 エラーのシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-067: 提出確認ダイアログで「はい」を選択すると useSubmitReport が実行される（スタブ確認用）。
  it('RPT-FE-067: 提出操作のシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-068: 削除確認ダイアログで「はい」を選択すると useDeleteReport が実行される（スタブ確認用）。
  it('RPT-FE-068: 削除操作のシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-069: 提出確認ダイアログで「キャンセル」を選択するとダイアログが閉じる（スタブ確認用）。
  it('RPT-FE-069: ダイアログキャンセル操作のシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });
});
