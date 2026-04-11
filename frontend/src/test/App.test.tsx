// App のスモークテスト。
// 認証系ページは pages/login/__tests__ 等の専用テストで検証するため、
// ここでは App のルーティング構成が壊れていないことのみ確認する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import LoginPage from '../pages/login/LoginPage';
import * as useLoginModule from '../hooks/useLogin';
import * as authStore from '../stores/auth';

// テスト用 QueryClient（retry=0）。
function createQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

describe('LoginPage smoke test', () => {
  beforeEach(() => {
    // useLogin Hook をモックする。
    vi.spyOn(useLoginModule, 'useLogin').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useLoginModule.useLogin>);
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // 実装済み LoginPage にはログインボタンが存在すること。
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });
});
