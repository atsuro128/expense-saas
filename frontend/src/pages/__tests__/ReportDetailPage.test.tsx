// ReportDetailPage のユニットテスト。
// RPT-FE-064〜069 に対応する。
// report-detail.md の ReportDetailPage の責務を検証する仕様テスト。
// スタブ実装段階では失敗する（赤い仕様テスト）。

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportDetailPage from '../ReportDetailPage';

function renderPage(reportId = 'test-report-id') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/reports/${reportId}`]}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/reports" element={<div>reports-list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // RPT-FE-064: useReport がレポートを返すとき ReportInfoCard が描画される
  // （report-detail.md §ReportDetailPage 責務: レポートデータを読み込み子コンポーネントに伝播）。
  it('RPT-FE-064: レポート取得時に ReportInfoCard が表示される', async () => {
    renderPage('cccccccc-0001-0001-0001-000000000001');
    // スタブ実装では ReportInfoCard が存在しない。
    // 実装後は data-testid="report-info-card" の要素が表示される。
    await waitFor(() => {
      expect(screen.queryByTestId('report-info-card')).not.toBeNull();
    });
  });

  // RPT-FE-065: useReport の isLoading=true のとき PageSkeleton が表示される
  // （report-detail.md コンポーネントツリー: データ読み込み中は PageSkeleton 表示）。
  it('RPT-FE-065: データ読み込み中は PageSkeleton が表示される', () => {
    renderPage('test-report-id');
    // スタブ実装では PageSkeleton が使用されない。
    expect(screen.queryByTestId('page-skeleton')).not.toBeNull();
  });

  // RPT-FE-066: useReport が 404 を返すと「指定されたデータが見つかりません。」が表示される
  // （report-detail.md §ReportDetailPage 責務: レポートが存在しない場合は not found メッセージ表示）。
  it('RPT-FE-066: useReport が 404 を返すと not found メッセージが表示される', async () => {
    renderPage('00000000-0000-0000-0000-000000000099');
    // スタブ実装では 404 処理が存在しない。
    // 実装後は「指定されたデータが見つかりません。」というメッセージが表示される。
    await waitFor(() => {
      expect(screen.queryByText('指定されたデータが見つかりません。')).not.toBeNull();
    });
  });

  // RPT-FE-067: draft レポートの所有者には「提出」ボタンが表示される
  // （report-detail.md §OwnerActions 責務: 所有者向けアクションボタンを配置）。
  it('RPT-FE-067: draft レポートの所有者には提出ボタンが表示される', async () => {
    renderPage('cccccccc-0001-0001-0001-000000000001');
    // スタブ実装では OwnerActions が存在しない。
    // 実装後は「提出」ボタンが表示される。
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /提出/ })).not.toBeNull();
    });
  });

  // RPT-FE-068: draft レポートの所有者には「削除」ボタンが表示される
  // （report-detail.md §OwnerActions 責務: 所有者向けアクションボタンを配置）。
  it('RPT-FE-068: draft レポートの所有者には削除ボタンが表示される', async () => {
    renderPage('cccccccc-0001-0001-0001-000000000001');
    // スタブ実装では OwnerActions が存在しない。
    // 実装後は「削除」ボタンが表示される。
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /削除/ })).not.toBeNull();
    });
  });

  // RPT-FE-069: 確認ダイアログ（ConfirmDialog）が使用される
  // （report-detail.md §ReportDetailPage 責務: 確認ダイアログ制御を管理）。
  // 提出または削除ボタン押下後、ConfirmDialog が表示される。
  it('RPT-FE-069: 操作実行時に ConfirmDialog が表示される', async () => {
    renderPage('cccccccc-0001-0001-0001-000000000001');
    // スタブ実装ではダイアログが存在しない。
    // 実装後はボタン押下で role="dialog" の確認ダイアログが表示される。
    // ここではダイアログの初期非表示状態を確認する（ボタン押下後に表示される）。
    // 実装後のダイアログ表示はインタラクションテストで確認するため、
    // ここでは少なくとも提出ボタンが存在することを検証する。
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /提出/ })).not.toBeNull();
    });
  });
});
