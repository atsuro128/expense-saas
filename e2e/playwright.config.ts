// Playwright 設定ファイル。
// test_strategy.md §10.1 の方針に準拠する:
//   - ブラウザ: Chromium のみ（MVP）
//   - ファイル配置: expense-saas/e2e/
//   - テスト環境: ローカルで起動済みアプリ（docker compose up 済み）に接続
//
// 実行前提:
//   docker compose up -d  (api: 8080, frontend: 5173)
//   npx playwright install chromium  (初回のみ)

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // テストファイルのパターン。
  testDir: './',
  testMatch: '**/*_test.ts',

  // 各テストのタイムアウト（E2E は低速なため十分なマージンを確保する）。
  timeout: 60_000,

  // expect のタイムアウト（DOM 更新やネットワーク待ち）。
  expect: {
    timeout: 15_000,
  },

  // テスト実行の設定。
  fullyParallel: false,

  // 失敗時のリトライ回数（ローカル実行では 0 で即失敗を検出する）。
  retries: 0,

  // 並列ワーカー数（フロー間で共通 DB を使うため直列実行する）。
  workers: 1,

  // レポーター設定。
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report', open: 'never' }],
  ],

  // 全テスト共通の設定。
  use: {
    // ローカル起動済みのフロントエンドに接続する。
    baseURL: 'http://localhost:5173',

    // ブラウザ操作のトレース（失敗時のデバッグ用）。
    trace: 'on-first-retry',

    // スクリーンショット（失敗時のみ）。
    screenshot: 'only-on-failure',

    // headless モード（ローカル CI 実行を想定）。
    headless: true,

    // ビューポート設定。
    viewport: { width: 1280, height: 720 },

    // ナビゲーションのタイムアウト。
    navigationTimeout: 30_000,

    // アクション（クリック等）のタイムアウト。
    actionTimeout: 15_000,
  },

  // ブラウザプロジェクト設定（Chromium のみ: MVP 方針）。
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
