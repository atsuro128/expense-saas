import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

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
