// テスト用の React レンダーヘルパー。
// MemoryRouter と QueryClientProvider を自動でラップする。

import { type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** renderWithProviders のオプション。 */
interface RenderOptions {
  /** MemoryRouter に渡す初期エントリー。省略時は ['/']。 */
  initialEntries?: MemoryRouterProps['initialEntries'];
  /** MemoryRouter の初期インデックス。省略時は 0。 */
  initialIndex?: number;
}

/**
 * テスト用の QueryClient を生成する。
 * retries=0 でエラーを即座に返す。
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * renderWithProviders は QueryClientProvider と MemoryRouter でラップした
 * コンポーネントを描画するテスト用ヘルパー。
 */
export function renderWithProviders(ui: ReactNode, options: RenderOptions = {}) {
  const { initialEntries = ['/'], initialIndex = 0 } = options;
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
