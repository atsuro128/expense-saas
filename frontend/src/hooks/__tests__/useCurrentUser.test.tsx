// useCurrentUser Hook のユニットテスト。
// DSH-FE-037〜DSH-FE-038 に対応する。
// MSW 未インストールのため fetch をモックして API 呼び出しをシミュレートする。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useCurrentUser } from '../useCurrentUser';
import * as authStore from '../../stores/auth';

/** テスト用 QueryClient ラッパーを生成する。 */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useCurrentUser', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalLocation: typeof window.location;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalLocation = window.location;
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue('test-token');
    vi.spyOn(authStore, 'getRefreshToken').mockReturnValue(null);
    // window.location のモック（リダイレクトテスト用）。
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '/' },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  // DSH-FE-037: GET /api/auth/me が成功したとき data に AuthUser が格納され、role が正しいこと。
  it('DSH-FE-037: GET /api/auth/me が成功したとき data に AuthUser が格納される', async () => {
    const mockUser = {
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      role: 'member' as const,
      tenant: { id: 'tenant-1', name: 'Test Corp' },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockUser }),
    } as unknown as Response);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({ data: mockUser });
    expect(result.current.data?.data.role).toBe('member');
    expect(result.current.error).toBeNull();
  });

  // DSH-FE-038: GET /api/auth/me が 401 を返したときエラーが設定されること。
  // リフレッシュトークンが null のため、clearTokens 後に /login へリダイレクトする。
  it('DSH-FE-038: GET /api/auth/me が 401 を返したときエラーが設定される', async () => {
    vi.spyOn(authStore, 'clearTokens').mockImplementation(() => {});

    // 1 回目（アクセストークンあり→401）、2 回目（リフレッシュ試行→401）のモック。
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => null },
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => null },
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
      } as unknown as Response);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // エラーが設定されること。
    expect(result.current.error).not.toBeNull();
  });
});
