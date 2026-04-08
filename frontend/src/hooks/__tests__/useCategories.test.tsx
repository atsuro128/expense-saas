// useCategories Hook のユニットテスト。
// ITM-FE-057〜059 に対応する。
// 実 Hook（useCategories.ts）を直接 import し、globalThis.fetch のみモックする。
// state-management.md §3 データフェッチ系に準拠する。
// queryKey: ['categories'], staleTime: Infinity

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import { useCategories } from '../useCategories';

// テスト用プロバイダーラッパー（queryClient を外部から注入できるよう関数版も提供）。
function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// 6 件の標準カテゴリフィクスチャ。
const mockCategories = [
  { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
  { id: 'cat-002', code: 'accommodation', name_ja: '宿泊費', sort_order: 2 },
  { id: 'cat-003', code: 'food', name_ja: '食費', sort_order: 3 },
  { id: 'cat-004', code: 'supplies', name_ja: '消耗品', sort_order: 4 },
  { id: 'cat-005', code: 'communication', name_ja: '通信費', sort_order: 5 },
  { id: 'cat-006', code: 'other', name_ja: 'その他', sort_order: 6 },
];

describe('useCategories', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ITM-FE-057: GET /api/categories が呼び出され、6 件のカテゴリ配列が返る。
  it('ITM-FE-057: GET /api/categories を呼び出し、6 件のカテゴリ配列が返る', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockCategories }),
    } as unknown as Response);

    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // GET /api/categories が呼ばれていること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/categories',
      expect.objectContaining({ method: 'GET' }),
    );
    // data に 6 件のカテゴリ配列が含まれること
    expect(result.current.data).toEqual(mockCategories);
  });

  // ITM-FE-058: staleTime=Infinity により 2 回目のレンダリングで API が再呼び出しされない。
  it('ITM-FE-058: staleTime=Infinity により 2 回目レンダリングで API が再呼び出しされない', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockCategories }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const wrapper = createWrapper(queryClient);

    // 1 回目のレンダリング
    const { result: result1 } = renderHook(() => useCategories(), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    const firstCallCount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // 2 回目のレンダリング（同じ queryClient を使用 -> staleTime=Infinity でキャッシュが有効）
    const { result: result2 } = renderHook(() => useCategories(), { wrapper });

    await waitFor(() => {
      expect(result2.current.isSuccess).toBe(true);
    });

    // fetch の呼び出し回数が増えていないこと（キャッシュが有効）
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(firstCallCount);
  });

  // ITM-FE-059: API が 500 を返すと error が設定される。
  it('ITM-FE-059: API が 500 INTERNAL_ERROR を返すと error が設定される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'INTERNAL_ERROR', message: 'サーバーエラー' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // error が設定され、data は undefined
    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeUndefined();
  });
});
