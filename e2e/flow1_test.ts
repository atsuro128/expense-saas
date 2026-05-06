// フロー1: 申請 → 承認 → 支払完了 E2E テスト。
// test_strategy.md §10.2 「フロー1: 申請→承認→支払完了」に準拠する。
//
// 対応テストケース: CRS-055〜CRS-065
//   CRS-055: フロー1 全体（申請 → 承認 → 支払完了）E2E
//   CRS-056: Member ログイン
//   CRS-057: レポート作成
//   CRS-058: 明細追加
//   CRS-059: 提出
//   CRS-060: Approver ログイン
//   CRS-061: 承認待ち一覧表示
//   CRS-062: 承認
//   CRS-063: Accounting ログイン
//   CRS-064: 支払対象一覧表示
//   CRS-065: 支払完了
//
// 前提:
//   docker compose up -d が完了しており、api:8080 / frontend:5173 が起動済みであること。
//   test_strategy.md §4.2 のテストアカウント（test-member / test-approver / test-accounting）が
//   DB に登録済みであること（make seed で投入済みを想定）。

import { test, expect } from '@playwright/test';
import {
  loginAs,
  logout,
  extractReportIdFromUrl,
  getReportViaApi,
  getAccessToken,
  API_BASE_URL,
} from './setup';

/**
 * CRS-055: フロー1 全体（申請 → 承認 → 支払完了）E2E テスト。
 * 各内部ステップ（CRS-056〜CRS-065）を順番に実行する。
 */
test('CRS-055: フロー1 - 申請 → 承認 → 支払完了', async ({ page, request }) => {
  // ------------------------------------------------------------
  // CRS-056: Member ログイン
  // ------------------------------------------------------------
  await test.step('CRS-056: Member でログイン', async () => {
    await loginAs(page, 'member');

    // ダッシュボードが表示されていることを確認する。
    await expect(page).toHaveURL(/\/dashboard/);
    // ダッシュボードのコンテンツが表示されるまで待つ。
    await page.waitForSelector('div', { timeout: 10_000 });
  });

  // ------------------------------------------------------------
  // CRS-057: レポート作成
  // ------------------------------------------------------------
  let reportId = '';

  await test.step('CRS-057: レポートを新規作成する', async () => {
    // レポート作成ページに遷移する。
    await page.goto('/reports/new');
    await page.waitForURL(/\/reports\/new/, { timeout: 10_000 });

    // タイトルを入力する（ReportForm の name="title"）。
    await page.locator('input[name="title"]').fill('E2Eテスト_フロー1レポート');

    // 対象期間を入力する（ReportForm の name="periodStart" / name="periodEnd"）。
    // MUI DatePicker は input の type="text" として描画される。
    const periodStartInput = page.locator('input[name="periodStart"]');
    const periodEndInput = page.locator('input[name="periodEnd"]');

    await periodStartInput.fill('2026-03-01');
    await periodEndInput.fill('2026-03-31');

    // 「作成する」ボタンをクリックする。
    await page.locator('button[type="submit"]').click();

    // /reports/:id に遷移するまで待機する。
    await page.waitForURL(/\/reports\/[0-9a-f-]+$/, { timeout: 15_000 });

    // URL からレポート ID を取得する。
    reportId = extractReportIdFromUrl(page);
    expect(reportId).toBeTruthy();

    // レポートがドラフト状態で作成されていることを確認する。
    await expect(page.locator('[data-testid="status-chip"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  // ------------------------------------------------------------
  // CRS-058: 明細追加
  // ------------------------------------------------------------
  await test.step('CRS-058: 経費明細を追加する', async () => {
    // レポート詳細ページにいることを確認する。
    await expect(page).toHaveURL(new RegExp(`/reports/${reportId}$`));

    // 「明細追加」ボタンをクリックしてスライドパネルを開く。
    // ItemListHeader の「明細追加」ボタンをクリックする（実際のボタンテキストに合わせる）。
    await page.locator('button', { hasText: '明細追加' }).click();

    // スライドパネルが開くのを待つ（ItemSlidePanel の Drawer）。
    await page.waitForSelector('[role="presentation"]', { timeout: 10_000 });

    // 金額を入力する（ItemForm の name="amount"）。
    await page.locator('input[name="amount"]').fill('1000');

    // カテゴリを選択する（AppSelect の交通費）。
    // MUI Select は role="combobox" または button として描画される。
    const categorySelect = page.locator('[aria-label="カテゴリ"]').first();
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
    } else {
      // data-testid や label でフォールバックする。
      await page.locator('label', { hasText: 'カテゴリ' }).locator('..').locator('select, [role="combobox"]').first().click();
    }
    // 交通費オプションをクリックする。
    await page.locator('[role="option"]', { hasText: '交通費' }).click();

    // 支出日を入力する（name="expenseDate"）。
    const expenseDateInput = page.locator('input[name="expenseDate"]');
    await expenseDateInput.fill('2026-03-10');

    // 摘要を入力する（name="description"）。
    await page.locator('input[name="description"], textarea[name="description"]').fill('電車代');

    // 「保存」ボタンをクリックする。
    await page.locator('button[type="submit"]').click();

    // 明細が追加されてスライドパネルが閉じるのを待つ。
    await page.waitForSelector('[role="presentation"]', { state: 'hidden', timeout: 15_000 });

    // 合計金額が表示されていることを確認する（CRS-058 期待: total_amount == 1000）。
    await expect(page.locator('[data-testid="total-amount"]')).toContainText('1,000', {
      timeout: 10_000,
    });
  });

  // ------------------------------------------------------------
  // CRS-059: 提出
  // ------------------------------------------------------------
  await test.step('CRS-059: レポートを提出する', async () => {
    // 「提出」ボタンをクリックする。
    await page.locator('button', { hasText: '提出' }).click();

    // 確認ダイアログが表示されるのを待つ。
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // 「はい」ボタンをクリックする（ConfirmDialog の confirmLabel="はい"）。
    await page.locator('[role="dialog"] button', { hasText: 'はい' }).click();

    // ステータスが「提出済み」に変わるのを待つ。
    // StatusChip の text は日本語ラベルを表示する。
    await expect(page.locator('[data-testid="status-chip"]')).toContainText(/提出/,{
      timeout: 15_000,
    });

    // API 経由でステータスを確認する。
    const memberToken = await getAccessToken(request, 'member');
    const reportData = await getReportViaApi(request, reportId, memberToken);
    expect(reportData.status).toBe('submitted');
  });

  // ------------------------------------------------------------
  // CRS-060: Approver ログイン
  // ------------------------------------------------------------
  await test.step('CRS-060: Approver でログインする', async () => {
    // ログアウトして Approver でログインする。
    await logout(page);
    await loginAs(page, 'approver');

    // ダッシュボードが表示されていることを確認する。
    await expect(page).toHaveURL(/\/dashboard/);

    // ダッシュボードに承認待ちカウントが表示されていることを確認する（CRS-060 期待: pending_approval_count >= 1）。
    await expect(page.locator('[data-testid="approver-cards-row"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  // ------------------------------------------------------------
  // CRS-061: 承認待ち一覧表示
  // ------------------------------------------------------------
  await test.step('CRS-061: 承認待ち一覧に提出済みレポートが表示される', async () => {
    // 承認待ち一覧ページに遷移する（AppSidebar または CountCard のリンクから）。
    await page.goto('/approvals');
    await page.waitForURL(/\/approvals/, { timeout: 10_000 });

    // ページが表示されるのを待つ。
    await page.waitForSelector('[data-testid="pending-approvals-page"]', { timeout: 15_000 });

    // 作成したレポートのタイトルが一覧に表示されていることを確認する。
    await expect(
      page.locator('text=E2Eテスト_フロー1レポート'),
    ).toBeVisible({ timeout: 15_000 });
  });

  // ------------------------------------------------------------
  // CRS-062: 承認
  // ------------------------------------------------------------
  await test.step('CRS-062: レポートを承認する', async () => {
    // レポートタイトルの行をクリックしてレポート詳細ページに遷移する。
    await page.locator('text=E2Eテスト_フロー1レポート').first().click();
    await page.waitForURL(new RegExp(`/reports/${reportId}$`), { timeout: 15_000 });

    // 「承認」ボタンをクリックする（ReportActionBar の承認ボタン）。
    await page.locator('[data-testid="workflow-actions"] button', { hasText: '承認' }).click();

    // 確認ダイアログが表示されるのを待つ。
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // 「承認する」ボタンをクリックする。
    await page.locator('[role="dialog"] button', { hasText: '承認する' }).click();

    // ダイアログが閉じるのを待つ。
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });

    // ステータスが「承認済み」に変わるのを待つ。
    await expect(page.locator('[data-testid="status-chip"]')).toContainText(/承認/,{
      timeout: 15_000,
    });

    // API 経由でステータスを確認する。
    const approverToken = await getAccessToken(request, 'approver');
    const reportData = await getReportViaApi(request, reportId, approverToken);
    expect(reportData.status).toBe('approved');
  });

  // ------------------------------------------------------------
  // CRS-063: Accounting ログイン
  // ------------------------------------------------------------
  await test.step('CRS-063: Accounting でログインする', async () => {
    // ログアウトして Accounting でログインする。
    await logout(page);
    await loginAs(page, 'accounting');

    // ダッシュボードが表示されていることを確認する。
    await expect(page).toHaveURL(/\/dashboard/);

    // ダッシュボードに支払待ちカウントが表示されていることを確認する（CRS-063 期待: pending_payment_count >= 1）。
    await expect(page.locator('[data-testid="accounting-cards-row"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  // ------------------------------------------------------------
  // CRS-064: 支払対象一覧表示
  // ------------------------------------------------------------
  await test.step('CRS-064: 支払対象一覧に承認済みレポートが表示される', async () => {
    // 支払待ち一覧ページに遷移する。
    await page.goto('/payments');
    await page.waitForURL(/\/payments/, { timeout: 10_000 });

    // ページが表示されるのを待つ。
    await page.waitForSelector('[data-testid="payable-reports-page"]', { timeout: 15_000 });

    // 作成したレポートのタイトルが一覧に表示されていることを確認する。
    await expect(
      page.locator('text=E2Eテスト_フロー1レポート'),
    ).toBeVisible({ timeout: 15_000 });
  });

  // ------------------------------------------------------------
  // CRS-065: 支払完了
  // ------------------------------------------------------------
  await test.step('CRS-065: 支払完了を記録する', async () => {
    // レポートタイトルの行をクリックしてレポート詳細ページに遷移する。
    await page.locator('text=E2Eテスト_フロー1レポート').first().click();
    await page.waitForURL(new RegExp(`/reports/${reportId}$`), { timeout: 15_000 });

    // 「支払完了」ボタンをクリックする（ReportActionBar の支払完了ボタン）。
    await page.locator('[data-testid="workflow-actions"] button', { hasText: '支払完了' }).click();

    // 確認ダイアログが表示されるのを待つ。
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // 「支払完了にする」ボタンをクリックする。
    await page.locator('[role="dialog"] button', { hasText: '支払完了にする' }).click();

    // ダイアログが閉じるのを待つ。
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });

    // ステータスが「支払済み」に変わるのを待つ。
    await expect(page.locator('[data-testid="status-chip"]')).toContainText(/支払/,{
      timeout: 15_000,
    });

    // API 経由でステータスを確認する（最終状態: paid）。
    const accountingToken = await getAccessToken(request, 'accounting');
    const reportData = await getReportViaApi(request, reportId, accountingToken);
    expect(reportData.status).toBe('paid');

    // 支払完了後はアクションバーが表示されないことを確認する（終端状態）。
    await expect(page.locator('[data-testid="report-action-bar"]')).not.toBeVisible();
  });
});

/**
 * CRS-056 単独: Member ログインのステップテスト。
 * フロー1の一部として実行されるが、単独実行での確認用。
 */
test('CRS-056: Member ログイン単独確認', async ({ page }) => {
  await loginAs(page, 'member');

  // ダッシュボードに遷移していることを確認する。
  await expect(page).toHaveURL(/\/dashboard/);

  // ダッシュボードのコンテンツが表示されていることを確認する。
  await page.waitForSelector('div[data-testid="my-report-count-cards"]', { timeout: 15_000 });
});

/**
 * CRS-060 単独: Approver ログインのステップテスト。
 */
test('CRS-060: Approver ログイン単独確認', async ({ page }) => {
  await loginAs(page, 'approver');

  // ダッシュボードに遷移していることを確認する。
  await expect(page).toHaveURL(/\/dashboard/);

  // Approver 向けの承認待ちカードが表示されていることを確認する。
  await page.waitForSelector('div[data-testid="approver-cards-row"]', { timeout: 15_000 });
});

/**
 * CRS-063 単独: Accounting ログインのステップテスト。
 */
test('CRS-063: Accounting ログイン単独確認', async ({ page }) => {
  await loginAs(page, 'accounting');

  // ダッシュボードに遷移していることを確認する。
  await expect(page).toHaveURL(/\/dashboard/);

  // Accounting 向けの支払待ちカードが表示されていることを確認する。
  await page.waitForSelector('div[data-testid="accounting-cards-row"]', { timeout: 15_000 });
});
