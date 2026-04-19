import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * 各テスト前に globalThis.fetch を vi.fn() で上書きする。
 * これにより、各テストで `expect(globalThis.fetch).not.toHaveBeenCalled()` が
 * "not a spy" エラーなく動作するようになる。
 * 各テストは独自に `globalThis.fetch = vi.fn()...` で上書き可能（既存テストの互換性を維持）。
 * テストファイル内の `afterEach(() => { globalThis.fetch = originalFetch })` は
 * この beforeEach で設定したスパイに戻す（正しい動作）。
 */
beforeEach(() => {
  globalThis.fetch = vi.fn().mockRejectedValue(
    new Error('globalThis.fetch was called without being mocked in this test'),
  );
});

/**
 * 各テスト後に document.body に直接追加されたトースト要素を削除する。
 * BodyToast コンポーネントは navigate 後もトーストを残すため、
 * テスト間での DOM 汚染を防ぐためにクリーンアップが必要。
 */
afterEach(() => {
  // data-testid="app-toast" を持つ要素の親コンテナを削除する。
  document.querySelectorAll('[data-testid="app-toast"]').forEach((el) => {
    const parent = el.parentElement;
    if (parent && parent !== document.body) {
      parent.remove();
    } else {
      el.remove();
    }
  });
});
