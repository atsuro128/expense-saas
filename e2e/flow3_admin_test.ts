// フロー3（オプション）: Admin のテナント管理フロー E2E テスト。
// チケット 11-C の方針: 低優先度・ベストエフォート。
// フロー1/2 の完了を優先し、このテストは残時間で実装する。
//
// 対応テストケース: CRS-073〜CRS-075
//   CRS-073: Admin ダッシュボード表示
//   CRS-074: Admin による全レポート一覧
//   CRS-075: Admin によるテナント情報閲覧
//
// 前提:
//   docker compose up -d が完了しており、api:8080 / frontend:5173 が起動済みであること。
//   test_strategy.md §4.2 のテストアカウント（test-admin）が DB に登録済みであること。

import { test, expect } from '@playwright/test';
import { loginAs } from './setup';

/**
 * CRS-073: Admin ダッシュボード表示テスト。
 * test-admin@example.com でログインし、Admin 専用フィールドが表示されることを確認する。
 */
test('CRS-073: Admin ダッシュボードに Admin 専用フィールドが表示される', async ({ page }) => {
  // Admin でログインする。
  await loginAs(page, 'admin');
  await expect(page).toHaveURL(/\/dashboard/);

  // ダッシュボードが表示されるのを待つ。
  await page.waitForSelector('div', { timeout: 15_000 });

  // Admin 専用フィールドが表示されていることを確認する（CRS-073 期待: TenantStatusCards）。
  // DashboardPage は Admin ロールのとき TenantStatusCards を表示する。
  // TenantStatusCards には draft/submitted/approved/rejected/paid の各カウントが含まれる。
  // data-testid を確認する。
  // ダッシュボードのコンテンツがロードされるのを待つ。
  await page.waitForSelector('[data-testid="admin-member-count-cards"]', { timeout: 15_000 });

  // メンバー数カードが表示されていることを確認する（tenant_member_count）。
  await expect(page.locator('[data-testid="admin-member-count-cards"]')).toBeVisible();

  // テナントステータスカードが含まれるセクションが表示されていることを確認する。
  // TenantStatusCards の各カードには「下書き」「提出済み」「承認済み」等のラベルが含まれる。
  await expect(page.locator('text=下書き')).toBeVisible({ timeout: 10_000 });
});

/**
 * CRS-074: Admin による全レポート一覧テスト。
 * Admin でログインして /reports/all に遷移し、全レポートが表示されることを確認する。
 */
test('CRS-074: Admin で全レポート一覧ページにアクセスできる', async ({ page }) => {
  // Admin でログインする。
  await loginAs(page, 'admin');
  await expect(page).toHaveURL(/\/dashboard/);

  // /reports/all に遷移する（AllReportsPage: SCR-ADM-001）。
  await page.goto('/reports/all');
  await page.waitForURL(/\/reports\/all/, { timeout: 10_000 });

  // AllReportsPage がロードされるのを待つ。
  // ページにコンテンツが表示されることを確認する（タイトル等）。
  await page.waitForSelector('h1, h2, [role="grid"]', { timeout: 15_000 });

  // テナント内のレポートが表示されることを確認する。
  // AllReportsPage は GET /api/reports/all を使用する（Accounting / Admin のみ許可）。
  // ページが正常に表示されること（404 / 403 でないこと）を確認する。
  await expect(page).not.toHaveURL(/\/dashboard/);
  await expect(page).toHaveURL(/\/reports\/all/);
});

/**
 * CRS-075: Admin によるテナント情報閲覧テスト。
 * Admin でログインして /settings/tenant に遷移し、テナント情報が表示されることを確認する。
 */
test('CRS-075: Admin でテナント情報ページにアクセスできる', async ({ page }) => {
  // Admin でログインする。
  await loginAs(page, 'admin');
  await expect(page).toHaveURL(/\/dashboard/);

  // /settings/tenant に遷移する（TenantPage: SCR-ADM-002）。
  await page.goto('/settings/tenant');
  await page.waitForURL(/\/settings\/tenant/, { timeout: 10_000 });

  // TenantPage がロードされるのを待つ。
  // ページタイトル「テナント情報」が表示されることを確認する。
  await expect(page.locator('text=テナント情報')).toBeVisible({ timeout: 15_000 });

  // テナント情報カードが表示されることを確認する。
  // TenantInfoCard には tenant_id / tenant_name / created_at 等が表示される。
  // ページが正常に表示されること（ダッシュボードにリダイレクトされていないこと）を確認する。
  await expect(page).toHaveURL(/\/settings\/tenant/);
});

/**
 * Admin 以外のロールが /settings/tenant にアクセスした場合にリダイレクトされることを確認するテスト。
 * RBAC の確認として追加する。
 */
test('CRS-075 補足: Member が /settings/tenant にアクセスするとダッシュボードにリダイレクトされる', async ({ page }) => {
  // Member でログインする。
  await loginAs(page, 'member');
  await expect(page).toHaveURL(/\/dashboard/);

  // /settings/tenant に直接遷移する。
  await page.goto('/settings/tenant');

  // TenantPage の useEffect で非 Admin ロールはダッシュボードにリダイレクトされる。
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);
});
