// useTenant Hook のユニットテスト。
// TNT-FE-013〜015 に対応する。
// fetch をモックして API 呼び出しをシミュレートする。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, beforeEach, afterEach } from 'vitest';
import { useTenant } from '../useTenant';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // staleTime のテスト: デフォルトを 0 に設定し、Hook の設定値（5分）を検証する。
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// staleTime テスト用: 同一 QueryClient でラップする。
function createSharedWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const mockTenantResponse = {
  data: {
    id: 'aaaaaaaa-0001-0001-0001-000000000001',
    name: 'Test Company A',
    created_at: '2026-01-01T00:00:00Z',
  },
};

describe('useTenant', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // TNT-FE-013: GET /api/tenant が成功した場合、data にテナント情報が返ること。
  it('TNT-FE-013: GET /api/tenant が成功したとき data.data にテナント情報が返る', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockTenantResponse,
    } as unknown as Response);

    const { result } = renderHook(() => useTenant(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // data.data.id がテナント UUID と一致すること。
    expect(result.current.data?.data.id).toBe('aaaaaaaa-0001-0001-0001-000000000001');

    // data.data.name が "Test Company A" であること。
    expect(result.current.data?.data.name).toBe('Test Company A');
  });

  // TNT-FE-014: 2回目のレンダリングでは API が再呼び出しされないこと（staleTime 5分のキャッシュ）。
  it('TNT-FE-014: staleTime 5 分のキャッシュが有効で 2 回目のレンダリングでは API が再呼び出しされない', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockTenantResponse,
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    const { wrapper } = createSharedWrapper();

    // 1 回目のレンダリング。
    const { result: result1 } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    // 2 回目のレンダリング（同一 QueryClient = キャッシュが有効）。
    const { result: result2 } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result2.current.isSuccess).toBe(true);
    });

    // fetch は 1 回だけ呼ばれること（staleTime 5分のキャッシュが有効）。
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // TNT-FE-015: API エラー時に error が非 null であること。
  it('TNT-FE-015: GET /api/tenant が 500 を返したとき error が非 null で isError が true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useTenant(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // error が非 null であること。
    expect(result.current.error).not.toBeNull();
    expect(result.current.isError).toBe(true);
  });
});
