// E2E テスト用セットアップユーティリティ。
// test_strategy.md §4.2 で定義されたテストアカウントでのログイン処理と
// ストレージステートの保存・読み込みを提供する。
//
// 設計方針:
//   - テストアカウントは標準フィクスチャの4ロール（member/approver/accounting/admin）を使用する。
//   - E2E テストはローカルで起動済みのアプリ（docker compose up 済み）に接続する。
//   - フィクスチャ投入: バックエンドの seed エンドポイント（/api/test/seed）が利用可能な場合はそれを使う。
//     利用不可の場合は、各テストが独立してデータを作成する設計とする。

import type { Page, APIRequestContext } from '@playwright/test';

/** テストアカウント定義（test_strategy.md §4.2 準拠）。 */
export const TEST_ACCOUNTS = {
  member: {
    email: 'test-member@example.com',
    password: 'TestPass1!',
    role: 'member',
  },
  approver: {
    email: 'test-approver@example.com',
    password: 'TestPass1!',
    role: 'approver',
  },
  accounting: {
    email: 'test-accounting@example.com',
    password: 'TestPass1!',
    role: 'accounting',
  },
  admin: {
    email: 'test-admin@example.com',
    password: 'TestPass1!',
    role: 'admin',
  },
} as const;

/** API ベース URL（docker compose でのバックエンドポート）。 */
export const API_BASE_URL = 'http://localhost:8080';

/** フロントエンドのベース URL。 */
export const FRONTEND_BASE_URL = 'http://localhost:5173';

/** テストアカウントのロール型。 */
export type AccountRole = keyof typeof TEST_ACCOUNTS;

/**
 * 指定ロールのユーザーで UI ログインを行う。
 * ログインフォームからの入力を模倣し、ダッシュボードへの遷移を確認する。
 *
 * @param page - Playwright の Page オブジェクト。
 * @param role - ログインするロール。
 */
export async function loginAs(page: Page, role: AccountRole): Promise<void> {
  const account = TEST_ACCOUNTS[role];

  // ログインページに遷移する。
  await page.goto('/login');

  // ログインフォームに入力する。
  // LoginForm は name="email" / name="password" で入力フィールドを識別する。
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);

  // ログインボタンをクリックしてダッシュボードへの遷移を待つ。
  await page.locator('button[type="submit"]').click();

  // ダッシュボードに遷移するまで待機する。
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

/**
 * API 経由でのログインを行い、アクセストークンを取得する。
 * ローカルフィクスチャ操作や API 状態確認に使用する。
 *
 * @param request - Playwright の APIRequestContext。
 * @param role - ログインするロール。
 * @returns アクセストークン文字列。
 */
export async function getAccessToken(
  request: APIRequestContext,
  role: AccountRole,
): Promise<string> {
  const account = TEST_ACCOUNTS[role];

  const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
    data: {
      email: account.email,
      password: account.password,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `ログインに失敗しました (${account.email}): ${response.status()} ${body}`,
    );
  }

  const body = await response.json() as { data: { access_token: string } };
  return body.data.access_token;
}

/**
 * ログアウト処理を行う。
 * ブラウザのローカルストレージをクリアして /login にリダイレクトする。
 *
 * @param page - Playwright の Page オブジェクト。
 */
export async function logout(page: Page): Promise<void> {
  // ローカルストレージのトークンをクリアする（AuthStore のキー）。
  await page.evaluate(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  });

  // /login にリダイレクトする。
  await page.goto('/login');
  await page.waitForURL('**/login', { timeout: 10_000 });
}

/**
 * E2E テスト用のシードデータを投入する。
 * バックエンドに /api/test/seed エンドポイントが存在する場合のみ有効。
 * 存在しない場合は各テストが独立してデータを作成する。
 *
 * @param request - Playwright の APIRequestContext。
 * @param token - 管理者のアクセストークン。
 * @returns シード投入が成功したかどうか。
 */
export async function seedTestData(
  request: APIRequestContext,
  token: string,
): Promise<boolean> {
  const response = await request.post(`${API_BASE_URL}/api/test/seed`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.ok();
}

/**
 * 現在表示されているページのステータスチップテキストを取得する。
 * ReportInfoCard の data-testid="status-chip" を参照する。
 *
 * @param page - Playwright の Page オブジェクト。
 * @returns ステータステキスト（例: "提出済み"、"承認済み"等）。
 */
export async function getStatusChipText(page: Page): Promise<string> {
  const statusChip = page.locator('[data-testid="status-chip"]');
  return statusChip.innerText();
}

/**
 * API 経由でレポートの詳細情報を取得する。
 * テスト内でのステータス確認に使用する。
 *
 * @param request - Playwright の APIRequestContext。
 * @param reportId - レポート ID。
 * @param token - アクセストークン。
 * @returns レポートデータ。
 */
export async function getReportViaApi(
  request: APIRequestContext,
  reportId: string,
  token: string,
): Promise<Record<string, unknown>> {
  const response = await request.get(`${API_BASE_URL}/api/reports/${reportId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok()) {
    throw new Error(`レポート取得に失敗しました (${reportId}): ${response.status()}`);
  }

  const body = await response.json() as { data: Record<string, unknown> };
  return body.data;
}

/**
 * 現在の URL からレポート ID を抽出する。
 * /reports/:id 形式の URL を想定する。
 *
 * @param page - Playwright の Page オブジェクト。
 * @returns レポート ID 文字列。
 */
export function extractReportIdFromUrl(page: Page): string {
  const url = page.url();
  const match = url.match(/\/reports\/([^/]+)/);
  if (!match) {
    throw new Error(`URL からレポート ID を抽出できませんでした: ${url}`);
  }
  return match[1];
}
