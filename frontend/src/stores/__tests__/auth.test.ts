// stores/auth.ts のユニットテスト。
// sessionStorage への書き込み・読み取り・削除および
// プライベートモード等での例外時フォールバックを検証する。

import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';

// モジュール再評価（動的 import）を用いてモジュール初回ロード時の復元を検証するため、
// 各テストケースで必要に応じて import を行う。

describe('stores/auth', () => {
  // 各テスト前に sessionStorage をクリアし、モジュールキャッシュをリセットする。
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  // AUTH-001: setTokens を呼ぶと sessionStorage に書き込まれること。
  it('AUTH-001: setTokens が sessionStorage にトークンを書き込む', async () => {
    const { setTokens } = await import('../auth');

    setTokens('access-token-001', 'refresh-token-001');

    expect(sessionStorage.getItem('auth.access_token')).toBe('access-token-001');
    expect(sessionStorage.getItem('auth.refresh_token')).toBe('refresh-token-001');
  });

  // AUTH-002: setTokens 後に getAccessToken / getRefreshToken がメモリから取得できること。
  it('AUTH-002: getAccessToken / getRefreshToken がメモリから値を返す', async () => {
    const { setTokens, getAccessToken, getRefreshToken } = await import('../auth');

    setTokens('access-token-002', 'refresh-token-002');

    expect(getAccessToken()).toBe('access-token-002');
    expect(getRefreshToken()).toBe('refresh-token-002');
  });

  // AUTH-003: モジュール再評価後に sessionStorage からトークンが復元されること。
  // F5 リロード相当: JavaScript モジュールが再評価される状況を再現する。
  it('AUTH-003: モジュール再評価後も sessionStorage からトークンが復元される', async () => {
    // 初回ロード: トークンを保存する。
    const { setTokens } = await import('../auth');
    setTokens('restored-access', 'restored-refresh');

    // モジュールキャッシュをリセットして再評価させる（F5 相当）。
    vi.resetModules();

    // 再評価後の import: モジュール初回ロード時に sessionStorage から復元される。
    const { getAccessToken, getRefreshToken } = await import('../auth');

    expect(getAccessToken()).toBe('restored-access');
    expect(getRefreshToken()).toBe('restored-refresh');
  });

  // AUTH-004: clearTokens を呼ぶと sessionStorage から削除されること。
  it('AUTH-004: clearTokens が sessionStorage のトークンを削除する', async () => {
    const { setTokens, clearTokens, getAccessToken, getRefreshToken } = await import('../auth');

    setTokens('access-to-clear', 'refresh-to-clear');
    clearTokens();

    // sessionStorage から削除されていること。
    expect(sessionStorage.getItem('auth.access_token')).toBeNull();
    expect(sessionStorage.getItem('auth.refresh_token')).toBeNull();
    // メモリキャッシュも null になっていること。
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  // AUTH-005: sessionStorage.setItem が例外を投げる環境でもメモリ専用で機能すること。
  // プライベートモード（Safari）等で sessionStorage が利用不可の状況を再現する。
  it('AUTH-005: sessionStorage が利用不可の環境でもメモリ専用で動作する', async () => {
    // sessionStorage.setItem が例外を投げるようにモックする。
    const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { setTokens, getAccessToken, getRefreshToken } = await import('../auth');

    // 例外が発生しても setTokens が正常に完了すること。
    expect(() => setTokens('mem-access', 'mem-refresh')).not.toThrow();

    // メモリキャッシュには値が保存されていること。
    expect(getAccessToken()).toBe('mem-access');
    expect(getRefreshToken()).toBe('mem-refresh');

    // sessionStorage の setItem を元に戻す。
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(originalSetItem);
  });

  // AUTH-006: clearTokens 後に getAccessToken が null を返すこと。
  it('AUTH-006: clearTokens 後は getAccessToken が null を返す', async () => {
    const { setTokens, clearTokens, getAccessToken } = await import('../auth');

    setTokens('some-access', 'some-refresh');
    clearTokens();

    expect(getAccessToken()).toBeNull();
  });

  // AUTH-007: 初期状態（sessionStorage が空）では getAccessToken が null を返すこと。
  it('AUTH-007: 初期状態では getAccessToken が null を返す', async () => {
    // sessionStorage は beforeEach でクリア済みなので、モジュール再評価後は null になる。
    const { getAccessToken, getRefreshToken } = await import('../auth');

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
