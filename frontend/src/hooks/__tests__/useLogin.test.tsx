// useLogin Hook のユニットテスト。
// AUTH-FE-021〜024 に対応する。
// MSW が未インストールのため fetch をモックして API 呼び出しをシミュレートする。

import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import { useLogin } from '../useLogin';
import * as authStore from '../../stores/auth';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useLogin', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.spyOn(authStore, 'setTokens');
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    vi.spyOn(authStore, 'getRefreshToken').mockReturnValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // AUTH-FE-021: API 呼び出しが成功し AuthTokens が返ること。
  it('AUTH-FE-021: mutateAsync が AuthTokens を返す', async () => {
    const mockTokens = {
      user: { id: 'user1', name: 'Test User', email: 'user@example.com', role: 'admin' as const },
      tenant: { id: 'tenant1', name: 'Test Corp' },
      access_token: 'access123',
      refresh_token: 'refresh456',
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockTokens }),
    } as unknown as Response);

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    let tokens;
    await act(async () => {
      tokens = await result.current.mutateAsync({
        email: 'user@example.com',
        password: 'TestPass1!',
      });
    });

    expect(tokens).toEqual(mockTokens);
  });

  // AUTH-FE-022: 401 INVALID_CREDENTIALS エラー時に ApiClientError が投げられること。
  it('AUTH-FE-022: 401 エラー時に ApiClientError が投げられる', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: 'user@example.com', password: 'WrongPass!' }),
      ).rejects.toThrow();
    });
  });

  // AUTH-FE-023: 429 RATE_LIMIT_EXCEEDED エラー時に ApiClientError が投げられること。
  it('AUTH-FE-023: 429 エラー時に ApiClientError が投げられる', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: 'user@example.com', password: 'TestPass1!' }),
      ).rejects.toThrow();
    });
  });

  // AUTH-FE-024: ログイン成功時に AuthStore.setTokens が呼ばれること。
  it('AUTH-FE-024: ログイン成功時に AuthStore.setTokens が呼ばれる', async () => {
    const mockTokens = {
      user: { id: 'user1', name: 'Test User', email: 'user@example.com', role: 'admin' as const },
      tenant: { id: 'tenant1', name: 'Test Corp' },
      access_token: 'access123',
      refresh_token: 'refresh456',
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockTokens }),
    } as unknown as Response);

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        email: 'user@example.com',
        password: 'TestPass1!',
      });
    });

    // onSuccess で setTokens が呼ばれること。
    expect(authStore.setTokens).toHaveBeenCalledWith('access123', 'refresh456');
  });
});
