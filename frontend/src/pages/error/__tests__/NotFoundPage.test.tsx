// NotFoundPage のユニットテスト。
// 表示内容・ダッシュボードリンク・data-testid の存在を検証する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import NotFoundPage from '../NotFoundPage';

/**
 * NotFoundPage を MemoryRouter でラップして描画するヘルパー。
 * React Router の Link コンポーネントにはルーターコンテキストが必要なため MemoryRouter を使用する。
 */
function renderNotFoundPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  );
}

describe('NotFoundPage', () => {
  // NFP-001: 「お探しのページが見つかりません」見出しが表示されること。
  it('NFP-001: 見出し「お探しのページが見つかりません」を表示する', () => {
    renderNotFoundPage();
    expect(
      screen.getByText('お探しのページが見つかりません'),
    ).toBeInTheDocument();
  });

  // NFP-002: 「ダッシュボードへ戻る」リンクが /dashboard を指していること。
  it('NFP-002: 「ダッシュボードへ戻る」リンクが /dashboard に遷移する', () => {
    renderNotFoundPage();
    const link = screen.getByTestId('not-found-dashboard-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  // NFP-003: data-testid が正しく設定されていること。
  it('NFP-003: data-testid が正しく設定されている', () => {
    renderNotFoundPage();
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByTestId('not-found-dashboard-link')).toBeInTheDocument();
  });
});
