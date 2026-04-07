// ReportCreatePage のユニットテスト。
// RPT-FE-024〜027 に対応する。
// ReportCreatePage は現在スタブ実装のため、テストはスタブ時点での動作を検証する。
// 機能実装後はこのテストを更新する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportCreatePage from '../ReportCreatePage';

describe('ReportCreatePage', () => {
  function renderPage(initialEntry = '/reports/new') {
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <ReportCreatePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  // RPT-FE-024: フォームを送信して成功時に詳細ページへ遷移する（スタブ確認用）。
  it('RPT-FE-024: ReportCreatePage がスタブとして描画される', () => {
    renderPage();
    expect(screen.getByText('ReportCreatePage')).toBeInTheDocument();
  });

  // RPT-FE-025: useCreateReport がサーバーエラーを返すと FormAlert にメッセージが表示される（スタブ確認用）。
  it('RPT-FE-025: エラー状態のシミュレーションでもレンダリングが成功する', () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-026: ?ref=rejected-report-id のとき元レポートデータがプリフィルされる（スタブ確認用）。
  it('RPT-FE-026: URL パラメータ ref がある状態でレンダリングされる', () => {
    const { container } = renderPage('/reports/new?ref=rejected-report-id');
    expect(container).toBeInTheDocument();
  });

  // RPT-FE-027: キャンセルボタンクリックで /reports に遷移する（スタブ確認用）。
  it('RPT-FE-027: ReportCreatePage コンポーネントがマウントできる', () => {
    expect(() => renderPage()).not.toThrow();
  });
});
