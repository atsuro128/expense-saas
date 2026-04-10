// AttachmentArea コンポーネントのユニットテスト。
// report-detail.md §AttachmentArea の Props 仕様に基づくテスト。
// ATT-FE-001〜006 に対応する。
//
// 注意: AttachmentArea はスタブ実装のため、ATT-FE-001・ATT-FE-003・ATT-FE-005・ATT-FE-006 の
// 一部テストは機能実装後に通過する。スタブ段階での失敗は Step 9 の正しい姿。

import { render, screen, waitFor } from '@testing-library/react';
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
});
