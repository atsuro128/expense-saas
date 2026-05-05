// ReportDetailPage + ItemSlidePanel + ItemForm 結合テスト。
// 「保存して続けて追加」二重 POST 回帰防止テスト（issue #170）。
//
// 旧バグの構造:
//   子（ItemSlidePanel.handleAddModeSubmit）と
//   親（ReportDetailPage.handleItemSaveAndContinue）の両方が createItem.mutate を呼んでいた。
//   その結果、「保存して続けて追加」押下時に POST /api/reports/:id/items が 2 回発行され
//   同一明細が重複登録される blocker が発生していた。
//
// 検証方針:
//   ReportDetailPage を全体マウントし、親子配線を含めた形で POST 回数をアサートする。
//   ItemSlidePanel 単体テストでは onItemSaveAndContinue prop を渡さなければ
//   else { onSaveAndContinueProp() } 経路しか通らず旧バグを再現できないため、
//   本テストは必ず ReportDetailPage 経由でマウントする（設計書 items.md §12.3 備考参照）。
//
// ITM-FE-109 / ITM-FE-110 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import ReportDetailPage from '../ReportDetailPage';

// useReport / useSubmitReport / useDeleteReport / useCurrentUser / useCategories をモックする。
// useItems（useCreateItem を含む）はモックしない。実際の fetch を通して POST 回数を検証する。
vi.mock('../../../hooks/useReports', () => ({
  useReport: vi.fn(),
  useSubmitReport: vi.fn(),
  useDeleteReport: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('../../../hooks/useCategories', () => ({
  useCategories: vi.fn(),
}));

// ワークフロー操作フックをモックする（ReportDetailPage が常に呼ぶ）。
vi.mock('../../../hooks/useApproveReport', () => ({
  useApproveReport: vi.fn(),
}));

vi.mock('../../../hooks/useRejectReport', () => ({
  useRejectReport: vi.fn(),
}));

vi.mock('../../../hooks/useMarkAsPaid', () => ({
  useMarkAsPaid: vi.fn(),
}));

// vi.mock 後に import することでモック済みの関数参照を取得する。
import { useReport, useSubmitReport, useDeleteReport } from '../../../hooks/useReports';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useCategories } from '../../../hooks/useCategories';
import { useApproveReport } from '../../../hooks/useApproveReport';
import { useRejectReport } from '../../../hooks/useRejectReport';
import { useMarkAsPaid } from '../../../hooks/useMarkAsPaid';

const mockUseReport = vi.mocked(useReport);
const mockUseSubmitReport = vi.mocked(useSubmitReport);
const mockUseDeleteReport = vi.mocked(useDeleteReport);
const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUseCategories = vi.mocked(useCategories);
const mockUseApproveReport = vi.mocked(useApproveReport);
const mockUseRejectReport = vi.mocked(useRejectReport);
const mockUseMarkAsPaid = vi.mocked(useMarkAsPaid);

// テスト用 draft 状態のレポート詳細データ（明細なし）。
const mockDraftReportDetail = {
  id: 'report-170-test',
  title: '出張費（issue #170 テスト）',
  period_start: '2026-04-01',
  period_end: '2026-04-30',
  status: 'draft' as const,
  total_amount: 0,
  submitter: { id: 'current-user-id', name: 'テスト太郎' },
  items: [],
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

// テスト用の現在ユーザー（レポートの所有者）。
const mockCurrentUser = {
  id: 'current-user-id',
  name: 'テスト太郎',
  email: 'test@example.com',
  role: 'member' as const,
  tenant: { id: 'tenant-id', name: 'テナントA' },
};

// テスト用カテゴリ一覧。
const mockCategories = [
  { id: 'cat-001', code: 'TRANSPORT', name_ja: '交通費', sort_order: 1 },
];

// テスト用ページをレンダリングするヘルパー。
function renderPage(reportId = 'report-170-test') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/reports/${reportId}`]}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { queryClient };
}

// GET /api/reports/:id の空レスポンス（ReportDetailPage の useReport は Hook モックで対応するため不要だが
// useAttachments など他の GET は fetch を通すため空レスポンスを返すデフォルトハンドラが必要）。
function makeDefaultGetResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      data: [],
      pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
    }),
  } as unknown as Response;
}

// POST /api/reports/:id/items の成功レスポンスを生成するヘルパー。
function makeCreateItemResponse(itemId: string): Response {
  return {
    ok: true,
    status: 201,
    headers: { get: () => null },
    json: async () => ({
      data: {
        id: itemId,
        report_id: 'report-170-test',
        expense_date: '2026-04-20',
        amount: 3000,
        category: { id: 'cat-001', code: 'TRANSPORT', name_ja: '交通費', sort_order: 1 },
        description: '二重 POST 回帰テスト',
        attachments: [],
        created_at: '2026-04-20T00:00:00Z',
        updated_at: '2026-04-20T00:00:00Z',
      },
    }),
  } as unknown as Response;
}

// POST /api/reports/:id/items/:itemId/attachments の成功レスポンスを生成するヘルパー。
function makeCreateAttachmentResponse(attachmentId: string): Response {
  return {
    ok: true,
    status: 201,
    headers: { get: () => null },
    json: async () => ({
      data: {
        id: attachmentId,
        item_id: 'item-170-no-dup',
        file_name: 'receipt.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        created_at: '2026-04-20T00:00:00Z',
      },
    }),
  } as unknown as Response;
}

// テスト用ファイルオブジェクト生成ヘルパー。
function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('ReportDetailPage 「保存して続けて追加」二重 POST 回帰防止（issue #170）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;

    // 各 Hook のデフォルトモックを設定する。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCurrentUser.mockReturnValue({ data: { data: mockCurrentUser }, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseReport.mockReturnValue({ data: { data: mockDraftReportDetail }, isLoading: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSubmitReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseDeleteReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCategories.mockReturnValue({ data: mockCategories, isLoading: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseApproveReport.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseRejectReport.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseMarkAsPaid.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ITM-FE-109: 添付なし「保存して続けて追加」で POST items が 1 回のみ呼ばれる。
  // ReportDetailPage 全体をマウントして親子配線を含めた形で検証する。
  // 旧バグに戻す（ReportDetailPage.handleItemSaveAndContinue を復活させて
  //   onItemSaveAndContinue prop 経由で配線）と、POST が 2 回呼ばれてこのテストが FAIL することを確認済み。
  it('ITM-FE-109: does_not_double_post_when_save_and_add_clicked_without_attachments', async () => {
    const user = userEvent.setup();

    // POST /api/reports/:id/items の呼び出し回数を記録する。
    let postItemsCallCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      if (
        method === 'POST' &&
        typeof url === 'string' &&
        url.includes('/api/reports/report-170-test/items') &&
        !url.includes('/attachments')
      ) {
        postItemsCallCount++;
        return makeCreateItemResponse('item-170-no-dup');
      }
      // GET（useAttachments 等）はデフォルト空レスポンスを返す。
      return makeDefaultGetResponse();
    });

    renderPage();

    // ReportDetailPage が描画されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('report-info-card')).toBeInTheDocument();
    });

    // 「明細追加」ボタンをクリックして ItemSlidePanel を追加モードで開く。
    // MUI Drawer が開くと body に aria-hidden がつくため { hidden: true } で取得する。
    const addButton = screen.getByRole('button', { name: /明細追加/, hidden: true });
    await user.click(addButton);

    // ItemSlidePanel（Drawer）が開くまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // フォームに全フィールドを入力する。
    await user.type(screen.getByLabelText(/日付/), '2026-04-20');
    await user.type(screen.getByLabelText(/金額/), '3000');
    // カテゴリ Select を開いて選択する。
    const categorySelect = screen.getByRole('combobox', { name: /カテゴリ/ });
    await user.click(categorySelect);
    await user.click(screen.getByRole('option', { name: '交通費' }));
    await user.type(screen.getByLabelText(/摘要/), '二重 POST 回帰テスト');

    // 「保存して続けて追加」ボタンをクリックする。
    const saveAndContinueButton = screen.getByRole('button', { name: /保存して続けて追加/ });
    await user.click(saveAndContinueButton);

    // 保存完了後にパネルが再オープン（add モード）されるまで待機する。
    // formKey インクリメントにより ItemSlidePanel が再マウントされ、フォームがリセットされる。
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // POST /api/reports/:id/items が 1 回のみ呼ばれていること（重複 POST 防止）。
    // 旧実装（親の handleItemSaveAndContinue 復活 + onItemSaveAndContinue prop 配線）に戻すと
    // POST が 2 回呼ばれてこのアサーションが FAIL する。
    expect(postItemsCallCount).toBe(1);
  });

  // ITM-FE-110: 添付あり「保存して続けて追加」で POST items が 1 回のみ、
  // POST attachments がファイル数だけ呼ばれる。
  // ReportDetailPage 全体をマウントして親子配線を含めた形で検証する。
  // 旧バグに戻すと POST items が 2 回呼ばれてこのテストが FAIL することを確認済み。
  it('ITM-FE-110: does_not_double_post_when_save_and_add_clicked_with_attachments', async () => {
    const user = userEvent.setup();

    // POST コール数をそれぞれ記録する。
    let postItemsCallCount = 0;
    let postAttachmentsCallCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      if (
        method === 'POST' &&
        typeof url === 'string' &&
        url.includes('/api/reports/report-170-test/items') &&
        !url.includes('/attachments')
      ) {
        postItemsCallCount++;
        return makeCreateItemResponse('item-170-with-att');
      }
      if (
        method === 'POST' &&
        typeof url === 'string' &&
        url.includes('/attachments')
      ) {
        postAttachmentsCallCount++;
        return makeCreateAttachmentResponse(`att-170-${postAttachmentsCallCount}`);
      }
      // GET（useAttachments 等）はデフォルト空レスポンスを返す。
      return makeDefaultGetResponse();
    });

    renderPage();

    // ReportDetailPage が描画されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('report-info-card')).toBeInTheDocument();
    });

    // 「明細追加」ボタンをクリックして ItemSlidePanel を追加モードで開く。
    const addButton = screen.getByRole('button', { name: /明細追加/, hidden: true });
    await user.click(addButton);

    // ItemSlidePanel（Drawer）が開くまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // AttachmentArea（追加モード）が表示されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    });

    // 添付ファイル 1 件をローカル保留する。
    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    await user.upload(fileInput, jpegFile);

    // フォームに全フィールドを入力する。
    await user.type(screen.getByLabelText(/日付/), '2026-04-20');
    await user.type(screen.getByLabelText(/金額/), '3000');
    // カテゴリ Select を開いて選択する。
    const categorySelect = screen.getByRole('combobox', { name: /カテゴリ/ });
    await user.click(categorySelect);
    await user.click(screen.getByRole('option', { name: '交通費' }));
    await user.type(screen.getByLabelText(/摘要/), '添付あり二重 POST 回帰テスト');

    // 「保存して続けて追加」ボタンをクリックする。
    const saveAndContinueButton = screen.getByRole('button', { name: /保存して続けて追加/ });
    await user.click(saveAndContinueButton);

    // 保存完了後にパネルが再オープン（add モード）されるまで待機する。
    // 添付アップロードを含むため通常保存より時間がかかる可能性があるため waitFor を使う。
    await waitFor(
      () => {
        expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // POST /api/reports/:id/items が 1 回のみ呼ばれていること（重複 POST 防止）。
    // 旧実装（親の handleItemSaveAndContinue 復活 + onItemSaveAndContinue prop 配線）に戻すと
    // POST が 2 回呼ばれてこのアサーションが FAIL する。
    expect(postItemsCallCount).toBe(1);

    // POST /api/reports/:id/items/:itemId/attachments がファイル数（1）だけ呼ばれていること。
    // 順次アップロード経路が正常に機能していることを確認する（ATT-FE-079 との観点重複を避け、
    // ここでは「items が 1 回のみ」のデータ整合性検証を主目的とする）。
    expect(postAttachmentsCallCount).toBe(1);
  });
});
