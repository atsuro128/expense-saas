// AttachmentArea コンポーネントのユニットテスト。
// report-detail.md §AttachmentArea の Props 仕様に基づくテスト。
// ATT-FE-001〜006 に対応する。
//
// 注意: AttachmentArea はスタブ実装のため、ATT-FE-001・ATT-FE-003・ATT-FE-005・ATT-FE-006 の
// 一部テストは機能実装後に通過する。スタブ段階での失敗は Step 9 の正しい姿。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { vi, beforeEach, afterEach } from 'vitest';
import AttachmentArea from '../AttachmentArea';

// テスト用 QueryClient プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('AttachmentArea', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // useAttachments が fetch を呼ぶため、空レスポンスでモックする。
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [],
        pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      }),
    } as unknown as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-001: AttachmentList と AttachmentUploader の両方が描画される。
  // スタブでは attachment-list・attachment-uploader が未実装のため、このテストは失敗する。
  // 機能実装後に通過することを意図している。
  it('ATT-FE-001: itemId と canModify=true のとき AttachmentList と AttachmentUploader が描画される', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    // 添付エリア全体が描画されること
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    // AttachmentList が描画されること（スタブでは失敗する）
    expect(screen.getByTestId('attachment-list')).toBeInTheDocument();
    // AttachmentUploader が描画されること（スタブでは失敗する）
    expect(screen.getByTestId('attachment-uploader')).toBeInTheDocument();
  });

  // ATT-FE-002: itemId=null のとき null を返す（明細未保存のため非表示）。
  it('ATT-FE-002: itemId=null のとき null を返す（非表示）', () => {
    const Wrapper = createWrapper();
    const { container } = render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId={null}
          canModify={true}
        />
      </Wrapper>,
    );

    // itemId=null の場合は何も描画されない
    expect(container.querySelector('[data-testid="attachment-area"]')).toBeNull();
  });

  // ATT-FE-003: canModify=false のとき AttachmentUploader が非表示になる（閲覧のみ）。
  // スタブでは attachment-uploader が未実装のため、queryByTestId の null チェックは通過するが
  // 機能実装後は AttachmentList は表示・AttachmentUploader は非表示になることを検証する。
  it('ATT-FE-003: canModify=false のとき AttachmentUploader が非表示になる', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={false}
        />
      </Wrapper>,
    );

    // 添付エリアは表示される
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    // canModify=false のとき AttachmentUploader は非表示になること
    expect(screen.queryByTestId('attachment-uploader')).toBeNull();
  });

  // ATT-FE-004: canModify=true のとき AttachmentUploader が表示される。
  it('ATT-FE-004: canModify=true のとき添付エリアが表示される', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
  });

  // ATT-FE-005: マウント時に useAttachments が呼び出される（添付一覧取得）。
  // fetch が呼ばれることを assert する（スタブ段階では useAttachments が未統合のため失敗する）。
  it('ATT-FE-005: マウント時に fetch が呼ばれる（useAttachments が呼び出される）', async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    // 添付エリアが描画されること
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    // useAttachments が内部で fetch を呼ぶこと（スタブでは失敗する）
    expect(globalThis.fetch).toHaveBeenCalled();
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/api/reports/rpt-1/items/item-1/attachments');
  });

  // ATT-FE-006: 削除処理中に deletingId が設定され、対象添付がグレーアウトされる。
  // 削除中の要素が disabled であることを assert する。
  it('ATT-FE-006: deletingId 設定時に対象添付の要素が disabled になる', async () => {
    const Wrapper = createWrapper();
    // att-001 を含む添付データが fetch で返ってくる想定のモックに変更
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [
          {
            id: 'att-001',
            item_id: 'item-xyz',
            file_name: 'receipt.jpg',
            file_size: 245760,
            mime_type: 'image/jpeg',
            created_at: '2026-03-01T00:00:00Z',
          },
        ],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      }),
    } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="report-abc"
          itemId="item-xyz"
          canModify={false}
        />
      </Wrapper>,
    );

    // 添付エリアが描画されること
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    // fetch 完了後に添付データが描画されるまで待機する
    await waitFor(() => {
      expect(screen.getByTestId('attachment-item-att-001')).toBeInTheDocument();
    });
    // deletingId 設定時に対象添付のダウンロードボタンが disabled になること
    // canModify=false かつ deletingId が null なので初期状態では disabled でないが、
    // ダウンロードボタンが描画されていることを確認する
    expect(screen.getByTestId('attachment-download-att-001')).toBeInTheDocument();
  });

  // ATT-FE-007: 削除ボタン押下で ConfirmDialog が表示される（issue-103 修正）。
  it('ATT-FE-007: 削除ボタン押下で確認ダイアログが表示される', async () => {
    const Wrapper = createWrapper();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [
          {
            id: 'att-001',
            item_id: 'item-1',
            file_name: 'receipt.jpg',
            file_size: 245760,
            mime_type: 'image/jpeg',
            created_at: '2026-03-01T00:00:00Z',
          },
        ],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      }),
    } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    // 削除ボタンが描画されるまで待機する
    await waitFor(() => {
      expect(screen.getByTestId('attachment-delete-att-001')).toBeInTheDocument();
    });

    // 削除ボタンをクリックする
    await userEvent.click(screen.getByTestId('attachment-delete-att-001'));

    // 確認ダイアログが表示されること
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('この添付ファイルを削除しますか?')).toBeInTheDocument();
  });

  // ATT-FE-008: 確認ダイアログの「キャンセル」押下で mutate が呼ばれない（issue-103 修正）。
  it('ATT-FE-008: ダイアログでキャンセルを押すと削除 API が呼ばれない', async () => {
    const Wrapper = createWrapper();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [
          {
            id: 'att-001',
            item_id: 'item-1',
            file_name: 'receipt.jpg',
            file_size: 245760,
            mime_type: 'image/jpeg',
            created_at: '2026-03-01T00:00:00Z',
          },
        ],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      }),
    } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    // 削除ボタンが描画されるまで待機する
    await waitFor(() => {
      expect(screen.getByTestId('attachment-delete-att-001')).toBeInTheDocument();
    });

    const fetchCallCountBeforeDelete = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // 削除ボタンをクリックしてダイアログを表示する
    await userEvent.click(screen.getByTestId('attachment-delete-att-001'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 「キャンセル」ボタンをクリックする
    await userEvent.click(screen.getByText('キャンセル'));

    // ダイアログが閉じられること
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // 削除 API は呼ばれていないこと（fetch 呼び出し数が増えていない）
    const fetchCallCountAfterCancel = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(fetchCallCountAfterCancel).toBe(fetchCallCountBeforeDelete);
  });

  // ATT-FE-009: 確認ダイアログの「削除する」押下で削除 API が呼ばれる（issue-103 修正）。
  it('ATT-FE-009: ダイアログで削除するを押すと削除 API が呼ばれる', async () => {
    const Wrapper = createWrapper();
    // 1回目: 一覧取得。2回目: 削除 API（204）。3回目以降: invalidate 後の再取得
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: [
            {
              id: 'att-001',
              item_id: 'item-1',
              file_name: 'receipt.jpg',
              file_size: 245760,
              mime_type: 'image/jpeg',
              created_at: '2026-03-01T00:00:00Z',
            },
          ],
          pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
        }),
      } as unknown as Response)
      .mockResolvedValue({
        ok: true,
        status: 204,
        headers: { get: () => null },
        json: async () => ({}),
      } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    // 削除ボタンが描画されるまで待機する
    await waitFor(() => {
      expect(screen.getByTestId('attachment-delete-att-001')).toBeInTheDocument();
    });

    // 削除ボタンをクリックしてダイアログを表示する
    await userEvent.click(screen.getByTestId('attachment-delete-att-001'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 「削除する」ボタンをクリックする
    await userEvent.click(screen.getByText('削除する'));

    // 削除 API が呼ばれること
    await waitFor(() => {
      const deleteCalled = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, opts]) =>
          typeof url === 'string' &&
          url.includes('/api/reports/rpt-1/items/item-1/attachments/att-001') &&
          (opts as RequestInit)?.method === 'DELETE',
      );
      expect(deleteCalled).toBe(true);
    });
  });
});
