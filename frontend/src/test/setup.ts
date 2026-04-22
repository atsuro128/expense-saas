import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

// jsdom 環境では URL.createObjectURL / URL.revokeObjectURL が未定義のため、
// #129 の添付プレビュー機能で使用される Blob URL 生成・解放をモックする。
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-' + Math.random().toString(36).slice(2));
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = vi.fn();
}

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
