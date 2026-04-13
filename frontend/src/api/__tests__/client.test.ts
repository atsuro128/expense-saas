// api/client.ts の 401 バイパス分岐テスト。
// - 認証エンドポイント（/api/auth/login、/api/auth/refresh）が 401 を返すとき、
//   refreshAccessToken を呼ばず ApiClientError を即座に throw することを検証する。
// - 通常エンドポイントが 401 を返すとき、refreshAccessToken を呼びリトライすることを検証する。

import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { api } from '../client';
import * as authStore from '../../stores/auth';

// fetch のモック用ヘルパー: 指定したステータスコードとボディで応答する Response を返す。
function makeFetchResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// 401 エラーレスポンス用ボディ。
const unauthorizedBody = {
  error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
};

// 200 成功レスポンス用ボディ。
const successBody = { data: { id: 'rpt-001', title: 'テスト申請' } };

// リフレッシュ成功レスポンス用ボディ（AuthTokens 型に準拠）。
const refreshSuccessBody = {
  data: { access_token: 'new-access', refresh_token: 'new-refresh' },
};

describe('api/client 401 バイパス分岐', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // window.location.href への代入を vitest が上書きできるよう設定する。
    // jsdom 環境では location の書き換えが必要なため defineProperty で対処する。
    Object.defineProperty(window, 'location', {
      value: { href: '/' },
      writable: true,
      configurable: true,
    });

    // fetch をモックに差し替える。
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    // auth store をクリーンな状態に戻す。
    authStore.clearTokens();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    authStore.clearTokens();
  });

  // CLT-401-001: /api/auth/login が 401 を返したとき、
  // refreshAccessToken が呼ばれず ApiClientError が即座に throw されること。
  it('CLT-401-001: /api/auth/login の 401 はリフレッシュをスキップして ApiClientError を throw する', async () => {
    // アクセストークンを設定しておく（リフレッシュが呼ばれたとしても呼び出し回数で検出できるよう）。
    authStore.setTokens('some-access', 'some-refresh');

    // /api/auth/login が 401 を返すようにモックする。
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(401, unauthorizedBody));

    await expect(api.post('/api/auth/login', { email: 'a@b.com', password: 'pw' })).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 401,
      code: 'UNAUTHORIZED',
    });

    // fetch が 1 回だけ呼ばれていること（リトライなし）。
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // CLT-401-002: /api/auth/refresh が 401 を返したとき、
  // 無限ループにならず ApiClientError が throw されること。
  it('CLT-401-002: /api/auth/refresh の 401 は無限ループせず ApiClientError を throw する', async () => {
    authStore.setTokens('some-access', 'some-refresh');

    // /api/auth/refresh が 401 を返すようにモックする。
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(401, unauthorizedBody));

    await expect(
      api.post('/api/auth/refresh', { refresh_token: 'some-refresh' }),
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 401,
      code: 'UNAUTHORIZED',
    });

    // fetch が 1 回だけ呼ばれていること（無限ループなし）。
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // CLT-401-003: 通常エンドポイント（/api/reports）が 401 を返したとき、
  // refreshAccessToken が呼ばれ（= /api/auth/refresh が fetch される）リトライされること。
  it('CLT-401-003: 通常エンドポイントの 401 は refreshAccessToken を呼びリトライする', async () => {
    // アクセストークンとリフレッシュトークンを設定する。
    authStore.setTokens('old-access', 'valid-refresh');

    fetchSpy
      // 1回目: /api/reports が 401 を返す。
      .mockResolvedValueOnce(makeFetchResponse(401, unauthorizedBody))
      // 2回目: /api/auth/refresh が成功する。
      .mockResolvedValueOnce(makeFetchResponse(200, refreshSuccessBody))
      // 3回目: リトライの /api/reports が成功する。
      .mockResolvedValueOnce(makeFetchResponse(200, successBody));

    const result = await api.get('/api/reports');

    // 成功レスポンスのデータが返されること。
    expect(result).toEqual(successBody);

    // fetch が 3 回呼ばれていること（初回 + リフレッシュ + リトライ）。
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // 2 回目の fetch が /api/auth/refresh であること。
    const secondCall = fetchSpy.mock.calls[1] as [string, RequestInit?];
    expect(secondCall[0]).toBe('/api/auth/refresh');
  });

  // CLT-401-004: 通常エンドポイントが 401 を返し、リフレッシュも失敗したとき、
  // ApiClientError が throw されること。
  it('CLT-401-004: リフレッシュ失敗時は ApiClientError を throw する', async () => {
    authStore.setTokens('old-access', 'expired-refresh');

    fetchSpy
      // 1回目: /api/reports が 401 を返す。
      .mockResolvedValueOnce(makeFetchResponse(401, unauthorizedBody))
      // 2回目: /api/auth/refresh が 401 を返す（リフレッシュトークン失効）。
      .mockResolvedValueOnce(makeFetchResponse(401, unauthorizedBody));

    await expect(api.get('/api/reports')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 401,
    });
  });
});
