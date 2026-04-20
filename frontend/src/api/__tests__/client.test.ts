// api/client.ts の 401 バイパス分岐テストおよび handleErrorResponse テスト。
// - 認証エンドポイント（/api/auth/login、/api/auth/refresh）が 401 を返すとき、
//   refreshAccessToken を呼ばず ApiClientError を即座に throw することを検証する。
// - 通常エンドポイントが 401 を返すとき、refreshAccessToken を呼びリトライすることを検証する。
// - handleErrorResponse が SERVER_ERROR_MESSAGES のマッピングを正しく適用することを検証する。

import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { api } from '../client';
import * as authStore from '../../stores/auth';
import { SERVER_ERROR_MESSAGES } from '../../lib/error-messages';

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

// handleErrorResponse の SERVER_ERROR_MESSAGES マッピングテスト。
// 各 HTTP ステータス / エラーコードに対して日本語メッセージが設定されることを検証する。
describe('api/client handleErrorResponse: SERVER_ERROR_MESSAGES マッピング', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  // JSON レスポンスを返す fetch モック用ヘルパー。
  function makeJsonErrorResponse(status: number, code: string, message: string): Response {
    return new Response(
      JSON.stringify({ error: { code, message } }),
      {
        status,
        statusText: '',
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // 非 JSON（テキスト）レスポンスを返す fetch モック用ヘルパー。
  function makeTextErrorResponse(status: number): Response {
    return new Response('Internal Server Error', {
      status,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: '/' },
      writable: true,
      configurable: true,
    });
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    authStore.clearTokens();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    authStore.clearTokens();
  });

  // CLT-ERR-001: 500 + INTERNAL_ERROR → INTERNAL_ERROR 文言
  it('CLT-ERR-001: 500 + INTERNAL_ERROR はサーバーとの通信失敗メッセージになる', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeJsonErrorResponse(500, 'INTERNAL_ERROR', 'Internal Server Error'),
    );

    await expect(api.get('/api/reports')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'サーバーとの通信に失敗しました。しばらくしてから再度お試しください。',
    });
  });

  // CLT-ERR-002: 429 + RATE_LIMIT_EXCEEDED → RATE_LIMIT_EXCEEDED 文言
  it('CLT-ERR-002: 429 + RATE_LIMIT_EXCEEDED はレート制限メッセージになる', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeJsonErrorResponse(429, 'RATE_LIMIT_EXCEEDED', 'Too Many Requests'),
    );

    await expect(api.get('/api/reports')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'しばらく待ってから再試行してください',
    });
  });

  // CLT-ERR-003: 404 + RESOURCE_NOT_FOUND → RESOURCE_NOT_FOUND 文言
  it('CLT-ERR-003: 404 + RESOURCE_NOT_FOUND はデータ未発見メッセージになる', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeJsonErrorResponse(404, 'RESOURCE_NOT_FOUND', 'Not Found'),
    );

    await expect(api.get('/api/reports/xxx')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: '指定されたデータが見つかりません。',
    });
  });

  // CLT-ERR-004: 403 + FORBIDDEN → FORBIDDEN 文言
  it('CLT-ERR-004: 403 + FORBIDDEN は権限エラーメッセージになる', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeJsonErrorResponse(403, 'FORBIDDEN', 'Forbidden'),
    );

    await expect(api.get('/api/admin')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 403,
      code: 'FORBIDDEN',
      message: 'この操作を行う権限がありません。',
    });
  });

  // CLT-ERR-005: 409 + CONFLICT → SERVER_ERROR_MESSAGES.CONFLICT 文言
  it('CLT-ERR-005: 409 + CONFLICT は競合エラーメッセージになる', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeJsonErrorResponse(409, 'CONFLICT', 'Conflict'),
    );

    await expect(api.put('/api/reports/rpt-001', {})).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 409,
      code: 'CONFLICT',
      message: SERVER_ERROR_MESSAGES['CONFLICT'],
    });
  });

  // CLT-ERR-006: 422 + VALIDATION_ERROR → サーバー側 message を優先する
  it('CLT-ERR-006: 422 + VALIDATION_ERROR はサーバー側メッセージを優先する', async () => {
    const serverValidationMessage = '入力内容に誤りがあります: タイトルは必須です';
    fetchSpy.mockResolvedValueOnce(
      makeJsonErrorResponse(422, 'VALIDATION_ERROR', serverValidationMessage),
    );

    await expect(api.post('/api/reports', {})).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 422,
      code: 'VALIDATION_ERROR',
      message: serverValidationMessage,
    });
  });

  // CLT-ERR-007: JSON パース失敗（非 JSON の 500）→ INTERNAL_ERROR 文言
  it('CLT-ERR-007: 非 JSON の 500 レスポンスは INTERNAL_ERROR 文言になる', async () => {
    fetchSpy.mockResolvedValueOnce(makeTextErrorResponse(500));

    await expect(api.get('/api/reports')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'サーバーとの通信に失敗しました。しばらくしてから再度お試しください。',
    });
  });
});

// 422 details パースの回帰テスト（issue 121 工程 C）。
// ApiClientError.details に ValidationError[] が正しく格納されることを検証する。
describe('api/client 422 details パース回帰テスト', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  // details 付き JSON エラーレスポンスを返す fetch モック用ヘルパー。
  function makeValidationErrorResponse(
    details: Array<{ field: string; message: string }> | undefined,
  ): Response {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: '入力内容に誤りがあります',
        ...(details !== undefined ? { details } : {}),
      },
    };
    return new Response(JSON.stringify(body), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: '/' },
      writable: true,
      configurable: true,
    });
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    authStore.clearTokens();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    authStore.clearTokens();
  });

  // CLT-DETAILS-001: 422 レスポンスに details 配列（単一フィールド）が含まれるとき、
  // ApiClientError.details に正しく格納されること。
  it('CLT-DETAILS-001: 422 レスポンスの details 配列が ApiClientError.details に反映される', async () => {
    const detailsPayload = [{ field: 'title', message: 'タイトルは必須です' }];
    fetchSpy.mockResolvedValueOnce(makeValidationErrorResponse(detailsPayload));

    await expect(api.post('/api/reports', {})).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 422,
      code: 'VALIDATION_ERROR',
      details: detailsPayload,
    });
  });

  // CLT-DETAILS-002: 422 レスポンスに details が存在しないとき、
  // ApiClientError.details が undefined になり例外なく動作すること。
  it('CLT-DETAILS-002: details が未指定の場合でも例外なく動作し details が undefined になる', async () => {
    // details キーなしのレスポンスを返す。
    fetchSpy.mockResolvedValueOnce(makeValidationErrorResponse(undefined));

    const error = await api.post('/api/reports', {}).catch((e: unknown) => e);

    expect(error).toMatchObject({
      name: 'ApiClientError',
      status: 422,
      code: 'VALIDATION_ERROR',
    });
    // details が undefined であること（キーなしレスポンスに対する fallback 確認）。
    expect((error as { details: unknown }).details).toBeUndefined();
  });

  // CLT-DETAILS-003: 422 レスポンスに複数フィールドの details が含まれるとき、
  // ApiClientError.details にすべての要素が保持されること。
  it('CLT-DETAILS-003: details[] に複数フィールドのエラーが含まれる場合すべて保持される', async () => {
    const detailsPayload = [
      { field: 'title', message: 'タイトルは必須です' },
      { field: 'period_start', message: '開始日は必須です' },
      { field: 'period_end', message: '終了日は開始日より後の日付を入力してください' },
    ];
    fetchSpy.mockResolvedValueOnce(makeValidationErrorResponse(detailsPayload));

    const error = await api.post('/api/reports', {}).catch((e: unknown) => e);

    expect(error).toMatchObject({
      name: 'ApiClientError',
      status: 422,
      code: 'VALIDATION_ERROR',
    });
    // details の全要素が保持されること。
    expect((error as { details: unknown }).details).toEqual(detailsPayload);
    expect((error as { details: unknown[] }).details).toHaveLength(3);
  });
});
