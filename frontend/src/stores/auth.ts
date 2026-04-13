// 認証トークンの保持・操作モジュール。
// アクセストークンとリフレッシュトークンを sessionStorage に永続化し、
// F5 リロード後もログイン状態を維持する。
// タブを閉じると sessionStorage は自動的に破棄される。

/** sessionStorage のキー名 */
const KEY_ACCESS_TOKEN = 'auth.access_token';
const KEY_REFRESH_TOKEN = 'auth.refresh_token';

// メモリキャッシュ: getAccessToken / getRefreshToken の高速パス。
// モジュール初回評価時に sessionStorage から復元する。
let accessToken: string | null = null;
let refreshToken: string | null = null;

/**
 * sessionStorage から値を安全に読み取る。
 * プライベートモード等で sessionStorage が使用不可の場合は null を返す。
 */
function safeGetItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    // sessionStorage が利用不可の環境ではメモリ専用にフォールバックする。
    return null;
  }
}

/**
 * sessionStorage に値を安全に書き込む。
 * 例外が発生した場合は静かに無視し、メモリ専用で動作する。
 */
function safeSetItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage が利用不可の環境では書き込みをスキップする。
  }
}

/**
 * sessionStorage から値を安全に削除する。
 * 例外が発生した場合は静かに無視する。
 */
function safeRemoveItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // sessionStorage が利用不可の環境では削除をスキップする。
  }
}

// モジュール初回ロード時に sessionStorage からトークンを復元する。
// これにより F5 後の最初の getAccessToken() 呼び出しでもメモリから返せる。
accessToken = safeGetItem(KEY_ACCESS_TOKEN);
refreshToken = safeGetItem(KEY_REFRESH_TOKEN);

/** アクセストークンを返す。メモリキャッシュから取得する。 */
export function getAccessToken(): string | null {
  return accessToken;
}

/** リフレッシュトークンを返す。メモリキャッシュから取得する。 */
export function getRefreshToken(): string | null {
  return refreshToken;
}

/**
 * トークンペアをメモリキャッシュと sessionStorage の両方に保存する。
 * @param access - アクセストークン
 * @param refresh - リフレッシュトークン
 */
export function setTokens(access: string, refresh: string): void {
  // メモリキャッシュを更新する。
  accessToken = access;
  refreshToken = refresh;
  // sessionStorage に永続化する（プライベートモード等では静かに失敗する）。
  safeSetItem(KEY_ACCESS_TOKEN, access);
  safeSetItem(KEY_REFRESH_TOKEN, refresh);
}

/**
 * トークンをメモリキャッシュと sessionStorage の両方から削除する。
 * ログアウト時・セッション切れ時に呼び出す。
 */
export function clearTokens(): void {
  // メモリキャッシュをクリアする。
  accessToken = null;
  refreshToken = null;
  // sessionStorage から削除する。
  safeRemoveItem(KEY_ACCESS_TOKEN);
  safeRemoveItem(KEY_REFRESH_TOKEN);
}
