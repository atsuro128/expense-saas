// グローバルトーストユーティリティ。
// ページ遷移後もトーストが消えないようにするための最小実装。
// コンポーネントの unmount に依存せず、専用コンテナを document.body に追加してトーストを管理する。
// Step 10 でグローバルトーストストア（Context / Zustand）に置き換える。

/** トーストの種別 */
export type GlobalToastSeverity = 'success' | 'error' | 'warning' | 'info';

/** 自動削除までの時間（ミリ秒） */
const AUTO_REMOVE_DELAY = 8000;

/** グローバルトーストコンテナの ID */
const CONTAINER_ID = 'global-toast-container';

/**
 * グローバルトーストコンテナ要素を取得する。なければ作成して document.body に追加する。
 */
function getContainer(): HTMLElement {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    document.body.appendChild(container);
  }
  return container;
}

/**
 * グローバルトーストを専用コンテナに追加して表示する。
 * ページ遷移後も DOM に残り、AUTO_REMOVE_DELAY 後に自動削除される。
 * コンポーネントのマウント/アンマウントに影響を受けない。
 *
 * @param message - 表示するメッセージ
 * @param severity - トーストの種別（error / warning / success / info）
 */
export function showGlobalToast(message: string, severity: GlobalToastSeverity): void {
  const container = getContainer();

  // 既存のトーストを削除して重複を防ぐ。
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // トースト要素を作成する。
  const el = document.createElement('div');
  el.setAttribute('data-testid', 'app-toast');
  el.setAttribute('data-severity', severity);
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  // textContent を使用することで XSS を防ぐ。
  el.textContent = message;

  // スタイルを設定する（テスト環境では表示確認不要だが視認性のため設定）。
  el.style.position = 'fixed';
  el.style.top = '16px';
  el.style.left = '50%';
  el.style.transform = 'translateX(-50%)';
  el.style.zIndex = '9999';
  el.style.padding = '12px 24px';
  el.style.borderRadius = '4px';
  el.style.backgroundColor = severity === 'error' ? '#d32f2f' : severity === 'warning' ? '#ed6c02' : '#2e7d32';
  el.style.color = '#fff';

  container.appendChild(el);

  // 一定時間後に自動削除する。
  setTimeout(() => {
    if (el.parentNode === container) {
      container.removeChild(el);
    }
  }, AUTO_REMOVE_DELAY);
}

/**
 * グローバルトーストコンテナ内のすべてのトーストを削除する。
 * ページ遷移先のコンポーネントがマウントされた時に前のトーストをクリーンアップするために使用する。
 */
export function clearGlobalToasts(): void {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}
