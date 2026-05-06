// フロー2: 却下 → 再申請 E2E テスト。
// test_strategy.md §10.2 「フロー2: 却下→再申請」に準拠する。
//
// 対応テストケース: CRS-066〜CRS-072
//   CRS-066: フロー2 全体（却下 → 再申請）E2E
//   CRS-067: 提出までの初期動作
//   CRS-068: Approver による却下
//   CRS-069: 却下理由の表示確認
//   CRS-070: 再申請（明細コピー）
//   CRS-071: 再申請（添付未コピー）の確認
//   CRS-072: 再申請レポートの提出
//
// openapi.yaml#createReport の説明:
//   「再申請の場合は reference_report_id を指定すると、元レポートの明細がコピーされる（添付はコピーされない）」
//
// 前提:
//   docker compose up -d が完了しており、api:8080 / frontend:5173 が起動済みであること。
//   test_strategy.md §4.2 のテストアカウント（test-member / test-approver）が
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

/** 却下理由テキスト（CRS-068 / CRS-069 で使用）。 */
const REJECTION_REASON = '金額の証憑が不足しています';

/**
 * CRS-066: フロー2 全体（却下 → 再申請）E2E テスト。
 * 各内部ステップ（CRS-067〜CRS-072）を順番に実行する。
 */
test('CRS-066: フロー2 - 却下 → 再申請', async ({ page, request }) => {
  let originalReportId = '';
  let newReportId = '';

  // ------------------------------------------------------------
  // CRS-067: 提出までの初期動作（Member でログイン → レポート作成 → 明細追加 → 提出）
  // ------------------------------------------------------------
  await test.step('CRS-067: Member でログインし、レポートを作成・明細追加・提出する', async () => {
    await loginAs(page, 'member');
    await expect(page).toHaveURL(/\/dashboard/);

    // レポート作成ページに遷移する。
    await page.goto('/reports/new');
    await page.waitForURL(/\/reports\/new/, { timeout: 10_000 });

    // タイトルを入力する。
    await page.locator('input[name="title"]').fill('E2Eテスト_フロー2レポート');

    // 対象期間を入力する。
    await page.locator('input[name="periodStart"]').fill('2026-04-01');
    await page.locator('input[name="periodEnd"]').fill('2026-04-30');

    // 「作成する」ボタンをクリックする。
    await page.locator('button[type="submit"]').click();

    // /reports/:id に遷移するまで待機する。
    await page.waitForURL(/\/reports\/[0-9a-f-]+$/, { timeout: 15_000 });
    originalReportId = extractReportIdFromUrl(page);
    expect(originalReportId).toBeTruthy();

    // 明細追加スライドパネルを開く（実際のボタンテキストに合わせる）。
    await page.locator('button', { hasText: '明細追加' }).click();
    await page.waitForSelector('[role="presentation"]', { timeout: 10_000 });

    // 明細を入力する。
    await page.locator('input[name="amount"]').fill('2000');

    // カテゴリを選択する。
    const categorySelect = page.locator('[aria-label="カテゴリ"]').first();
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
    } else {
      await page.locator('label', { hasText: 'カテゴリ' }).locator('..').locator('select, [role="combobox"]').first().click();
    }
    await page.locator('[role="option"]', { hasText: '飲食費' }).click();

    await page.locator('input[name="expenseDate"]').fill('2026-04-15');
    await page.locator('input[name="description"], textarea[name="description"]').fill('会議費用');

    // 「保存」をクリックする。
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector('[role="presentation"]', { state: 'hidden', timeout: 15_000 });

    // レポートを提出する。
    await page.locator('button', { hasText: '提出' }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    await page.locator('[role="dialog"] button', { hasText: 'はい' }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });

    // ステータスが「提出済み」に変わるのを待つ。
    await expect(page.locator('[data-testid="status-chip"]')).toContainText(/提出/, {
      timeout: 15_000,
    });

    // API 経由でステータスを確認する。
    const memberToken = await getAccessToken(request, 'member');
    const reportData = await getReportViaApi(request, originalReportId, memberToken);
    expect(reportData.status).toBe('submitted');
  });

  // ------------------------------------------------------------
  // CRS-068: Approver による却下
  // ------------------------------------------------------------
  await test.step('CRS-068: Approver でログインし、却下理由を入力して却下する', async () => {
    // ログアウトして Approver でログインする。
    await logout(page);
    await loginAs(page, 'approver');
    await expect(page).toHaveURL(/\/dashboard/);

    // 承認待ち一覧に遷移する。
    // page.goto() は SPA を再ロードするため auth.ts のメモリキャッシュがリセットされ
    // PrivateRoute が未認証と誤判定する可能性がある。
    // サイドバーのナビゲーションリンク（RouterLink → <a href="/approvals">）をクリックして
    // SPA 内ナビゲーションを使用することで auth.ts のメモリキャッシュを維持する
    // （screens.md §4.3 サイドナビゲーション準拠）。
    //
    // getByRole + exact: true でサイドナビの「承認待ち」リンクに絞る。
    // ダッシュボードの CountCard（href="/approvals"）はラベル「承認待ち」＋件数テキストを含む
    // ため、exact: true での完全一致によりサイドナビのみにマッチする
    // （screens.md §4.3 サイドナビゲーション準拠）。
    await page.getByRole('link', { name: '承認待ち', exact: true }).click();
    await page.waitForURL(/\/approvals/, { timeout: 10_000 });
    await page.waitForSelector('[data-testid="pending-approvals-page"]', { timeout: 15_000 });

    // 対象レポートをクリックして詳細ページに遷移する。
    await page.locator('text=E2Eテスト_フロー2レポート').first().click();
    await page.waitForURL(new RegExp(`/reports/${originalReportId}$`), { timeout: 15_000 });

    // 「却下」ボタンをクリックする。
    await page.locator('[data-testid="workflow-actions"] button', { hasText: '却下' }).click();

    // 確認ダイアログが表示されるのを待つ。
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // 却下理由を入力する（ConfirmDialog の inputField: 却下理由フィールド）。
    // ConfirmDialog は MUI TextField（multiline=true）を使用する（report-detail.md §D4 準拠）。
    // MUI TextField は内部で aria-hidden かつ readonly な hidden textarea を生成することがある。
    // そのため readonly または aria-hidden な textarea を除外したセレクタを使い、
    // ユーザーが実際に入力可能な textarea のみを選択する。
    const reasonInput = page.locator('[role="dialog"] textarea:not([readonly]):not([aria-hidden="true"])');
    await reasonInput.fill(REJECTION_REASON);

    // 「却下する」ボタンをクリックする。
    await page.locator('[role="dialog"] button', { hasText: '却下する' }).click();

    // ダイアログが閉じるのを待つ。
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });

    // ステータスが「却下」に変わるのを待つ。
    await expect(page.locator('[data-testid="status-chip"]')).toContainText(/却下/, {
      timeout: 15_000,
    });

    // API 経由でステータスを確認する。
    const approverToken = await getAccessToken(request, 'approver');
    const reportData = await getReportViaApi(request, originalReportId, approverToken);
    expect(reportData.status).toBe('rejected');
    expect(reportData.rejection_reason).toBe(REJECTION_REASON);
  });

  // ------------------------------------------------------------
  // CRS-069: 却下理由の表示確認
  // ------------------------------------------------------------
  await test.step('CRS-069: Member でログインし、却下理由が表示されていることを確認する', async () => {
    // ログアウトして Member でログインする。
    await logout(page);
    await loginAs(page, 'member');
    await expect(page).toHaveURL(/\/dashboard/);

    // 却下されたレポートの詳細ページに遷移する。
    await page.goto(`/reports/${originalReportId}`);
    await page.waitForURL(new RegExp(`/reports/${originalReportId}$`), { timeout: 15_000 });

    // レポート詳細ページが表示されるのを待つ。
    await page.waitForSelector('[data-testid="report-info-card"]', { timeout: 15_000 });

    // ステータスが「却下」であることを確認する（CRS-069 期待: status = "rejected"）。
    await expect(page.locator('[data-testid="status-chip"]')).toContainText(/却下/, {
      timeout: 10_000,
    });

    // 却下理由が表示されていることを確認する（CRS-069 期待: rejection_reason が表示される）。
    // ReportInfoCard の data-testid="rejection-reason" を参照する。
    await expect(page.locator('[data-testid="rejection-reason"]')).toContainText(REJECTION_REASON, {
      timeout: 10_000,
    });
  });

  // ------------------------------------------------------------
  // CRS-070: 再申請（明細コピー）
  // CRS-071: 再申請（添付未コピー）の確認
  // ------------------------------------------------------------
  await test.step('CRS-070/CRS-071: 「再申請」ボタンをクリックし、明細コピー・添付未コピーを確認する', async () => {
    // 「再申請」ボタンをクリックする（OwnerActions の再申請ボタン: status="rejected"）。
    // ReportActionBar → OwnerActions → status="rejected" → 「再申請」ボタン。
    await page.locator('button', { hasText: '再申請' }).click();

    // /reports/new?ref=:id に遷移するまで待機する。
    // ReportDetailPage の onResubmit: navigate(`/reports/new?ref=${report.id}`)
    await page.waitForURL(/\/reports\/new\?ref=/, { timeout: 15_000 });

    // URL に元レポートの ref パラメータが含まれることを確認する（CRS-070 期待: reference_report_id 付き）。
    const newReportUrl = page.url();
    expect(newReportUrl).toContain(`ref=${originalReportId}`);

    // フォームに元レポートのデータがプリフィルされていることを確認する。
    // ReportCreatePage は ?ref=:id から元レポートを取得してフォームにセットする。
    await page.waitForSelector('input[name="title"]', { timeout: 10_000 });
    // タイトルが元レポートと同じであることを確認する（プリフィル）。
    const titleValue = await page.locator('input[name="title"]').inputValue();
    expect(titleValue).toBe('E2Eテスト_フロー2レポート');

    // 「作成する」ボタンをクリックして再申請レポートを作成する。
    // フォームにすでにプリフィルされているので、そのまま送信する。
    await page.locator('button[type="submit"]').click();

    // /reports/:newId に遷移するまで待機する。
    await page.waitForURL(/\/reports\/[0-9a-f-]+$/, { timeout: 15_000 });
    newReportId = extractReportIdFromUrl(page);

    // 元レポートの ID と異なることを確認する（新規レポートが作成されている）。
    expect(newReportId).not.toBe(originalReportId);

    // API 経由で新規レポートを取得して確認する。
    const memberToken = await getAccessToken(request, 'member');
    const newReport = await getReportViaApi(request, newReportId, memberToken) as {
      status: string;
      reference_report_id: string;
      items: Array<{
        amount: number;
        description: string;
        attachments: unknown[];
      }>;
    };

    // CRS-070: ステータスが draft であることを確認する（新規 draft が作成される）。
    expect(newReport.status).toBe('draft');

    // CRS-070: reference_report_id が元レポートの ID であることを確認する（RPT-016）。
    expect(newReport.reference_report_id).toBe(originalReportId);

    // CRS-070: 明細がコピーされていることを確認する（openapi.yaml#createReport の説明）。
    expect(newReport.items.length).toBeGreaterThan(0);
    // コピーされた明細の金額と摘要が元レポートと同じであることを確認する。
    const copiedItem = newReport.items[0];
    expect(copiedItem.amount).toBe(2000);
    expect(copiedItem.description).toBe('会議費用');

    // CRS-071: 添付ファイルがコピーされていないことを確認する（openapi.yaml#createReport の説明）。
    // 元レポートには添付ファイルを追加していないため、空配列であることのみ確認する。
    expect(copiedItem.attachments).toEqual([]);
  });

  // ------------------------------------------------------------
  // CRS-070 補足: 画面での明細コピー確認
  // ------------------------------------------------------------
  await test.step('CRS-070: 再申請レポートの画面に明細がコピーされていることを確認する', async () => {
    // 再申請レポートの詳細ページにいることを確認する。
    await expect(page).toHaveURL(new RegExp(`/reports/${newReportId}$`));

    // 明細一覧に元レポートの明細が表示されていることを確認する。
    await expect(page.locator('text=会議費用')).toBeVisible({ timeout: 15_000 });

    // 合計金額が表示されていることを確認する。
    await expect(page.locator('[data-testid="total-amount"]')).toContainText('2,000', {
      timeout: 10_000,
    });

    // 再申請元リンクが表示されていることを確認する（reference_report_id が設定されている）。
    // ReportInfoCard に「元レポートを表示」リンクが表示される。
    await expect(page.locator('text=元レポートを表示')).toBeVisible({ timeout: 10_000 });
  });

  // ------------------------------------------------------------
  // CRS-072: 再申請レポートの提出
  // ------------------------------------------------------------
  await test.step('CRS-072: 再申請レポートを提出する', async () => {
    // 「提出」ボタンをクリックする。
    await page.locator('button', { hasText: '提出' }).click();

    // 確認ダイアログが表示されるのを待つ。
    await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

    // 「はい」ボタンをクリックする。
    await page.locator('[role="dialog"] button', { hasText: 'はい' }).click();

    // ダイアログが閉じるのを待つ。
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 15_000 });

    // ステータスが「提出済み」に変わるのを待つ。
    await expect(page.locator('[data-testid="status-chip"]')).toContainText(/提出/, {
      timeout: 15_000,
    });

    // API 経由でステータスを確認する（CRS-072 期待: status = "submitted"）。
    const memberToken = await getAccessToken(request, 'member');
    const reportData = await getReportViaApi(request, newReportId, memberToken);
    expect(reportData.status).toBe('submitted');

    // 元レポート（originalReportId）のステータスが変化していないことを確認する（RPT-015）。
    // 再申請後も元レポートは rejected のまま。
    const originalReport = await getReportViaApi(request, originalReportId, memberToken);
    expect(originalReport.status).toBe('rejected');
  });
});

/**
 * CRS-071 詳細テスト: 添付ファイル付き元レポートからの再申請で添付がコピーされないことを確認する。
 * 添付ファイルが実際に存在するシナリオで CRS-071 を検証する補足テスト。
 *
 * このテストは API 経由で添付ファイルを事前に追加した場合にのみ有効に機能する。
 * フロントエンドでの添付操作は E2E テストの複雑性を高めるため、
 * API 経由でレポート状態を準備してから UI で確認する。
 */
test('CRS-071: 添付付き元レポートの再申請で添付ファイルがコピーされないことを API で確認する', async ({ request }) => {
  // API 経由で Member トークンを取得する。
  const memberToken = await getAccessToken(request, 'member');

  // 新規レポートを API 経由で作成する。
  const createReportResp = await request.post(`${API_BASE_URL}/api/reports`, {
    headers: { Authorization: `Bearer ${memberToken}` },
    data: {
      title: 'CRS-071 添付テスト元レポート',
      period_start: '2026-05-01',
      period_end: '2026-05-31',
    },
  });
  expect(createReportResp.ok()).toBeTruthy();
  const createReportBody = await createReportResp.json() as { data: { id: string } };
  const originalReportId = createReportBody.data.id;

  // 明細を API 経由で追加する。
  const createItemResp = await request.post(
    `${API_BASE_URL}/api/reports/${originalReportId}/items`,
    {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: {
        expense_date: '2026-05-10',
        amount: 3000,
        category_id: await getCategoryId(request, memberToken, 'transportation'),
        description: '出張交通費',
      },
    },
  );
  expect(createItemResp.ok()).toBeTruthy();
  const createItemBody = await createItemResp.json() as { data: { id: string } };
  const itemId = createItemBody.data.id;

  // レポートを提出する。
  const submitResp = await request.post(
    `${API_BASE_URL}/api/reports/${originalReportId}/submit`,
    {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { updated_at: await getReportUpdatedAt(request, originalReportId, memberToken) },
    },
  );
  expect(submitResp.ok()).toBeTruthy();

  // Approver トークンを取得して却下する。
  const approverToken = await getAccessToken(request, 'approver');
  const originalReportBeforeReject = await getReportViaApi(request, originalReportId, approverToken) as { updated_at: string };
  const rejectResp = await request.post(
    `${API_BASE_URL}/api/workflow/${originalReportId}/reject`,
    {
      headers: { Authorization: `Bearer ${approverToken}` },
      data: {
        reason: '添付ファイルが不足しています',
        updated_at: originalReportBeforeReject.updated_at,
      },
    },
  );
  expect(rejectResp.ok()).toBeTruthy();

  // 再申請レポートを API 経由で作成する（reference_report_id を指定）。
  const resubmitResp = await request.post(`${API_BASE_URL}/api/reports`, {
    headers: { Authorization: `Bearer ${memberToken}` },
    data: {
      title: 'CRS-071 添付テスト再申請レポート',
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      reference_report_id: originalReportId,
    },
  });
  expect(resubmitResp.ok()).toBeTruthy();
  const resubmitBody = await resubmitResp.json() as { data: { id: string } };
  const newReportId = resubmitBody.data.id;

  // 再申請レポートを取得して確認する。
  const newReport = await getReportViaApi(request, newReportId, memberToken) as {
    reference_report_id: string;
    items: Array<{
      id: string;
      amount: number;
      description: string;
      attachments: unknown[];
    }>;
  };

  // reference_report_id が設定されていることを確認する（CRS-070: RPT-016）。
  expect(newReport.reference_report_id).toBe(originalReportId);

  // 明細がコピーされていることを確認する（CRS-070）。
  expect(newReport.items.length).toBeGreaterThan(0);

  // CRS-071: 各明細の attachments が空であることを確認する（添付はコピーされない）。
  for (const item of newReport.items) {
    expect(item.attachments).toEqual([]);
  }

  // 元明細の ID と再申請明細の ID が異なることを確認する（コピーにより新規 ID が付与される）。
  const newItemIds = newReport.items.map((i) => i.id);
  expect(newItemIds).not.toContain(itemId);
});

/**
 * カテゴリコードからカテゴリ ID を取得するヘルパー関数。
 */
async function getCategoryId(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  code: string,
): Promise<string> {
  const resp = await request.get(`${API_BASE_URL}/api/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok()) {
    throw new Error(`カテゴリ一覧取得に失敗しました: ${resp.status()}`);
  }

  // GET /api/categories は { data: [...] } 形式で返す（category.go の RespondJSON 参照）。
  const body = await resp.json() as { data: Array<{ id: string; code: string }> };
  const category = body.data.find((c) => c.code === code);
  if (!category) {
    throw new Error(`カテゴリが見つかりません: ${code}`);
  }
  return category.id;
}

/**
 * レポートの updated_at を取得するヘルパー関数。
 */
async function getReportUpdatedAt(
  request: import('@playwright/test').APIRequestContext,
  reportId: string,
  token: string,
): Promise<string> {
  const resp = await request.get(`${API_BASE_URL}/api/reports/${reportId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok()) {
    throw new Error(`レポート取得に失敗しました: ${resp.status()}`);
  }

  const body = await resp.json() as { data: { updated_at: string } };
  return body.data.updated_at;
}
