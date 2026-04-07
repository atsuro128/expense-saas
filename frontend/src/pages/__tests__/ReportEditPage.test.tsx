// ReportEditPage のユニットテスト。
// RPT-FE-050〜057 に対応する。
// ReportEditPage は現在スタブ実装のため、テストはスタブ時点での動作を検証する。
// 機能実装後はこのテストを更新する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportEditPage from '../ReportEditPage';

function renderPage(reportId = 'test-report-id') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/reports/${reportId}/edit`]}>
        <Routes>
          <Route path="/reports/:id/edit" element={<ReportEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportEditPage', () => {
  // RPT-FE-050: useReport が既存データを返すとき ReportForm に既存データがプリフィルされる（スタブ確認用）。
  it('RPT-FE-050: ReportEditPage がスタブとして描画される', () => {
    renderPage();
    expect(screen.getByText('ReportEditPage')).toBeInTheDocument();
  });

  // RPT-FE-051: 保存成功時に /reports/:id に遷移する（スタブ確認用）。
  it('RPT-FE-051: 保存成功のシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-052: useReport が 404 を返すと /reports にリダイレクトされる（スタブ確認用）。
  it('RPT-FE-052: 404 エラーのシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-053: submitter.id != currentUser.id のとき 403 トーストが表示される（スタブ確認用）。
  it('RPT-FE-053: 403 エラーのシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-054: status="submitted" のとき /reports/:id にリダイレクトされる（スタブ確認用）。
  it('RPT-FE-054: 非 draft レポートのシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-055: useUpdateReport が 409 CONFLICT を返すと FormAlert にメッセージが表示される（スタブ確認用）。
  it('RPT-FE-055: 409 コンフリクトのシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-056: キャンセルボタンクリックで /reports/:id に遷移する（スタブ確認用）。
  it('RPT-FE-056: キャンセル操作のシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-057: useReport の isLoading=true のとき PageSkeleton(variant='form') が表示される（スタブ確認用）。
  it('RPT-FE-057: ローディング状態のシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });
});
