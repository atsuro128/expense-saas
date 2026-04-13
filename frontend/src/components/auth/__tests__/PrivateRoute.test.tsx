// PrivateRoute のユニットテスト。
// 認証済み時は Outlet（子ルート）を描画し、未認証時は /login にリダイレクトして
// location.state.from に元 URL が保持されることを検証する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { vi, describe, it, afterEach, expect } from 'vitest';
import PrivateRoute from '../PrivateRoute';
import * as useAuthModule from '../../../hooks/useAuth';

// location.state.from を検証するためのヘルパーコンポーネント。
function LoginPage() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '(none)';
  return <div data-testid="login-page">login from={from}</div>;
}

// PrivateRoute の配下に描画されるダミー子コンポーネント。
function ProtectedPage() {
  return <div data-testid="protected-page">protected</div>;
}

/**
 * PrivateRoute をテスト用ルーティング環境で描画するヘルパー。
 * @param initialEntries - MemoryRouter の初期パス一覧
 */
function renderPrivateRoute(initialEntries: string[] = ['/protected']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<PrivateRoute />}>
          <Route path="/protected" element={<ProtectedPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PrivateRoute', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // PRT-001: 認証済み（isAuthenticated = true）のとき Outlet が描画されること。
  it('PRT-001: 認証済みのとき children（Outlet）を描画する', () => {
    // useAuth が認証済み状態を返すようにモックする。
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({ isAuthenticated: true });

    renderPrivateRoute(['/protected']);

    expect(screen.getByTestId('protected-page')).toBeInTheDocument();
    // /login にリダイレクトされていないこと。
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  // PRT-002: 未認証（isAuthenticated = false）のとき /login にリダイレクトされること。
  it('PRT-002: 未認証のとき /login にリダイレクトされる', () => {
    // useAuth が未認証状態を返すようにモックする。
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({ isAuthenticated: false });

    renderPrivateRoute(['/protected']);

    // /login に遷移し、LoginPage が描画されていること。
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    // protected ページは描画されていないこと。
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  // PRT-003: 未認証時、location.state.from に元の URL（pathname + search）が保持されること。
  it('PRT-003: 未認証時、location.state.from に元 URL が保持される', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({ isAuthenticated: false });

    // クエリパラメータ付きのパスでアクセスする。
    renderPrivateRoute(['/protected?tab=expense']);

    // LoginPage の描画内容から state.from が正しく渡っていることを確認する。
    expect(screen.getByTestId('login-page')).toHaveTextContent(
      'login from=/protected?tab=expense',
    );
  });
});
