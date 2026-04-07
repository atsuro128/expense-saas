// useRequestPasswordReset Hook のユニットテスト。
// AUTH-FE-055〜056 に対応する。

import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import { useRequestPasswordReset } from '../useRequestPasswordReset';
import * as authStore from '../../stores/auth';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useRequestPasswordReset', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    vi.spyOn(authStore, 'getRefreshToken').mockReturnValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // AUTH-FE-055: API 呼び出しが成功し message を含むレスポンスが返ること。
  it('AUTH-FE-055: mutateAsync が成功しレスポンスに message が含まれる', async () => {
    const mockResponse = { message: 'メールを送信しました' };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockResponse }),
    } as unknown as Response);

    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper: createWrapper() });

    let response;
    await act(async () => {
      response = await result.current.mutateAsync({ email: 'user@example.com' });
    });

    expect(response).toEqual(mockResponse);
    expect((response as typeof mockResponse).message).toBeTruthy();
  });

  // AUTH-FE-056: 500 エラー時に ApiClientError が投げられること。
  it('AUTH-FE-056: 500 エラー時に ApiClientError が投げられる', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: 'user@example.com' }),
      ).rejects.toThrow();
    });
  });
});
