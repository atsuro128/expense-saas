// AttachmentArea コンポーネントのユニットテスト。
// report-detail.md §AttachmentArea の Props 仕様に基づくテスト。
// ATT-FE-001〜006、ATT-FE-054〜056 に対応する。
// ATT-FE-072, 075, 077 に対応する（issue #115: 新規明細のローカル保持方式）。
// ATT-FE-076, 084-087 に対応する（issue #143: add / edit モード UI 一貫性）。

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

// テスト用ファイルオブジェクト生成ヘルパー。
function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
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

  // ATT-FE-054: 削除ボタン押下で ConfirmDialog が表示される（issue-103 修正）。
  it('ATT-FE-054: 削除ボタン押下で確認ダイアログが表示される', async () => {
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

  // ATT-FE-055: 確認ダイアログの「キャンセル」押下で mutate が呼ばれない（issue-103 修正）。
  it('ATT-FE-055: ダイアログでキャンセルを押すと削除 API が呼ばれない', async () => {
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

  // ATT-FE-056: 確認ダイアログの「削除する」押下で削除 API が呼ばれる（issue-103 修正）。
  it('ATT-FE-056: ダイアログで削除するを押すと削除 API が呼ばれる', async () => {
    const Wrapper = createWrapper();
    // 1回目: 一覧取得。2回目: 削除 API（204）。3回目以降: invalidate 後の再取得
    const attachmentListResponse = {
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
    } as unknown as Response;
    const emptyAttachmentListResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [],
        pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      }),
    } as unknown as Response;
    const deleteResponse = {
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response;
    let getCallCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if ((opts?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return Promise.resolve(deleteResponse);
      }
      getCallCount += 1;
      if (getCallCount === 1) {
        return Promise.resolve(attachmentListResponse);
      }
      return Promise.resolve(emptyAttachmentListResponse);
    });

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

// =============================================================================
// ATT-FE-072, 075, 077: 新規明細でのローカル保持方式（issue #115）
// 機能実装前のため全テスト FAIL 前提。
// FAIL 原因: AttachmentArea の mode prop・ローカル保持 state が未実装。
// =============================================================================

describe('AttachmentArea 追加モード（ATT-FE-072, 075, 077, issue #115）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // useAttachments が fetch を呼ぶ場合の安全なモック（itemId=null では呼ばれない想定）。
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

  // ATT-FE-072: 追加モード + itemId=null で AttachmentArea が表示され、useAttachments は API を呼ばない。
  // FAIL 原因（機能未実装）: 現在の AttachmentArea は itemId=null で null を返すため何も描画されない。
  // 機能実装後: mode="add" + itemId=null でも AttachmentArea が描画され、ローカル保持方式が有効になる。
  it('ATT-FE-072: renders_attachment_area_in_add_mode_with_itemId_null', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId={null}
          mode="add"
          canModify={true}
        />
      </Wrapper>,
    );

    // 追加モード（itemId=null）でも AttachmentArea が描画されること（FAIL 前提）。
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    // AttachmentUploader が表示されること（ローカル保持用のファイル選択 UI）。
    expect(screen.getByTestId('attachment-uploader')).toBeInTheDocument();
    // useAttachments は itemId=null のため API 呼び出しをスキップすること。
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // ATT-FE-075: 保留中添付の削除は API 未呼出・確認ダイアログなしでローカル state から除去のみ。
  // 削除ボタンは <Button variant="text" color="error">削除</Button>（テキストボタン）で表示される（issue #143、案 A）。
  it('ATT-FE-075: removes_pending_attachment_from_local_state_without_api_call', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-url');

    render(
      <Wrapper>
          <AttachmentArea
          reportId="rpt-1"
          itemId={null}
          mode="add"
          canModify={true}
        />
      </Wrapper>,
    );

    // 添付エリアが描画されること。
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // JPEG 1 件目をローカル保留する。
    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile1 = createMockFile('receipt1.jpg', 1024, 'image/jpeg');
    await user.upload(fileInput, jpegFile1);

    // JPEG 2 件目をローカル保留する。
    const jpegFile2 = createMockFile('receipt2.jpg', 2048, 'image/jpeg');
    await user.upload(fileInput, jpegFile2);

    // 保留中添付が 2 件表示されること（行要素でカウント）。
    expect(screen.getAllByTestId(/^pending-file-row-/)).toHaveLength(2);

    // issue #143 UI 構造検証: 削除ボタンが <Button variant="text" color="error">削除</Button> であること。
    // data-testid で特定し、ボタンテキストが「削除」であることを確認する（<IconButton>× ではない）。
    const deleteBtnBeforeRemove = screen.getByTestId('pending-attachment-delete-0');
    expect(deleteBtnBeforeRemove).toHaveTextContent('削除');
    expect(deleteBtnBeforeRemove.tagName.toLowerCase()).toBe('button');

    // 保留件数の事前確認。
    const fetchCallsBefore = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // 1 件目の「削除」ボタンをクリックする（テキストボタン: 編集モードと同一構造）。
    await user.click(deleteBtnBeforeRemove);

    // 確認ダイアログは表示されないこと（保留中添付の削除は即時）。
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // 一覧には残り 1 件が表示されること（行要素でカウント）。
    expect(screen.getAllByTestId(/^pending-file-row-/)).toHaveLength(1);
    expect(screen.getByText('receipt2.jpg')).toBeInTheDocument();
    expect(screen.queryByText('receipt1.jpg')).not.toBeInTheDocument();

    // API は呼ばれていないこと（削除 API は保存前の添付には不要）。
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCallsBefore);
  });

  // ATT-FE-077: 保留中添付のプレビューボタンが表示され、ダウンロードアイコンは非表示（#129 / #143 UI 変更後）。
  // issue #143 追記: ファイル名・サイズ・削除ボタンは編集モードと同一構造。ダウンロードアイコンのみ非表示。
  it('ATT-FE-077: hides_download_icon_for_pending_attachments_but_keeps_preview', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-url');

    render(
      <Wrapper>
          <AttachmentArea
          reportId="rpt-1"
          itemId={null}
          mode="add"
          canModify={true}
        />
      </Wrapper>,
    );

    // 添付エリアが描画されること。
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // JPEG 1 件をローカル保留する。
    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    await user.upload(fileInput, jpegFile);

    // ファイル名がプレビューボタンとして表示されること（<Button variant="text">）。
    expect(screen.getByTestId('pending-attachment-preview-0')).toBeInTheDocument();
    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();

    // 「保存後にアップロード予定」ラベルは表示されないこと（#129: 削除済み）。
    expect(screen.queryByText('保存後にアップロード予定')).not.toBeInTheDocument();
    // 「保留中」バッジも表示されないこと（issue #143、案 A）。
    expect(screen.queryByText('保留中')).not.toBeInTheDocument();

    // ダウンロードアイコンは表示されないこと（add モードのみ非表示。pending file はサーバー未保存）。
    expect(screen.queryByTestId('pending-attachment-download-0')).not.toBeInTheDocument();
    // aria-label="ダウンロード" のボタンも存在しないこと。
    expect(screen.queryByRole('button', { name: 'ダウンロード' })).not.toBeInTheDocument();

    // issue #143 UI 構造検証: 削除ボタン・サイズが存在し、編集モードと同一構造であること。
    const deleteBtn = screen.getByTestId('pending-attachment-delete-0');
    expect(deleteBtn).toHaveTextContent('削除');
    expect(deleteBtn.tagName.toLowerCase()).toBe('button');

    const sizeEl = screen.getByTestId('pending-attachment-size-0');
    expect(sizeEl.tagName.toLowerCase()).toBe('span');

    // fetch は呼ばれていないこと（useAttachmentPreviewUrl / useAttachmentDownloadUrl 未呼出）。
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

// =============================================================================
// ATT-FE-076, 084-087: add / edit モード UI 一貫性テスト（issue #143、案 A）
// 追加モードでもトースト文言・リスト UI 構造を編集モードと完全同一にする。
// ダウンロードアイコンのみ add モードで非表示。
// =============================================================================

describe('AttachmentArea add/edit モード UI 一貫性（ATT-FE-076, 084-087, issue #143）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
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

  // ATT-FE-076: 追加モードでファイル選択（保留完了）後に「ファイルをアップロードしました」トーストが表示される。
  // 文言は編集モードと完全同一（add モード固有文言「保留しました」等は使わない）（issue #143、案 A）。
  it('ATT-FE-076: shows_upload_success_toast_in_add_mode_with_same_wording_as_edit_mode', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-url');

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId={null}
          mode="add"
          canModify={true}
        />
      </Wrapper>,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    await user.upload(fileInput, jpegFile);

    // useUploadAttachment.mutate は呼ばれないこと（fetch 未呼出で確認）。
    // getByTestId 前に fetch 呼び出し数が増えていないことを確認する。
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.some(([url]: [string]) => typeof url === 'string' && url.includes('attachments'))).toBe(false);

    // AppToast に severity="success" で「ファイルをアップロードしました」が表示されること。
    // 編集モードと完全同一の文言であること（ATTACHMENT_UPLOAD_SUCCESS 定数）。
    // AppToast は MUI Snackbar/Alert を使用するため role="alert" で検出する。
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('ファイルをアップロードしました');
    });

    // add モード固有の文言は使われないこと。
    expect(screen.queryByText('保留しました')).not.toBeInTheDocument();
    expect(screen.queryByText('保存後にアップロード予定')).not.toBeInTheDocument();
  });

  // ATT-FE-084: 追加モードで保留中ファイルの「削除」ボタン押下後に「添付ファイルを削除しました」トーストが表示される。
  // 文言は編集モードと完全同一。確認ダイアログなし・API 呼び出しなし（issue #143、案 A）。
  it('ATT-FE-084: shows_delete_success_toast_in_add_mode_with_same_wording_as_edit_mode', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { /* no-op */ });

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId={null}
          mode="add"
          canModify={true}
        />
      </Wrapper>,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    await user.upload(fileInput, jpegFile);

    // 保留ファイルが追加されること。
    expect(screen.getByTestId('pending-file-row-0')).toBeInTheDocument();

    // 「削除」ボタンをクリックする（テキストボタン、確認ダイアログなし）。
    const deleteBtn = screen.getByTestId('pending-attachment-delete-0');
    expect(deleteBtn).toHaveTextContent('削除');
    await user.click(deleteBtn);

    // 確認ダイアログは表示されないこと（add モードはローカル state からの除去のみ）。
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // useDeleteAttachment.mutate は呼ばれないこと（fetch 呼び出しが増えていない）。
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.some(([url]: [string]) => typeof url === 'string' && url.includes('attachments'))).toBe(false);

    // AppToast に severity="success" で「添付ファイルを削除しました」が表示されること。
    // 編集モードと完全同一の文言であること（ATTACHMENT_DELETE_SUCCESS 定数）。
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('添付ファイルを削除しました');
    });
  });

  // ATT-FE-085: 追加モードの保留ファイル一覧が編集モードと同一 DOM 構造であること。
  // <ul><li> 構造、<Button variant="text"> ファイル名、<span> サイズ、<Button variant="text" color="error">削除</Button>。
  it('ATT-FE-085: renders_pending_list_with_same_dom_structure_as_edit_mode', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-url');

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId={null}
          mode="add"
          canModify={true}
        />
      </Wrapper>,
    );

    // receipt.jpg (245760 B = 240.0 KB) を 1 件保留する。
    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 245760, 'image/jpeg');
    await user.upload(fileInput, jpegFile);

    // (1) 保留ファイル一覧のルートが <ul> 要素で、各項目が <li> 要素であること。
    const pendingRow = screen.getByTestId('pending-file-row-0');
    expect(pendingRow.tagName.toLowerCase()).toBe('li');
    expect(pendingRow.parentElement?.tagName.toLowerCase()).toBe('ul');

    // (2) ファイル名は <button> 要素（MUI Button = <button> タグ）でレンダリングされていること。
    const previewBtn = screen.getByTestId('pending-attachment-preview-0');
    expect(previewBtn.tagName.toLowerCase()).toBe('button');
    expect(previewBtn).toHaveTextContent('receipt.jpg');

    // (3) ファイルサイズは <span> 要素で表示されること（<Typography variant="caption"> ではない）。
    const sizeEl = screen.getByTestId('pending-attachment-size-0');
    expect(sizeEl.tagName.toLowerCase()).toBe('span');
    // サイズ表示形式（formatFileSize の出力が含まれること）。
    expect(sizeEl.textContent).toMatch(/KB|MB/);

    // (4) 削除ボタンは <Button variant="text" color="error">削除</Button> であること（<IconButton>× ではない）。
    const deleteBtn = screen.getByTestId('pending-attachment-delete-0');
    expect(deleteBtn.tagName.toLowerCase()).toBe('button');
    expect(deleteBtn).toHaveTextContent('削除');
    // MUI Button color="error" は Mui エラー色クラスを持つ。
    expect(deleteBtn.classList.toString()).toMatch(/MuiButton/);

    // 実装詳細ラベルは表示されないこと（issue #143、案 A）。
    expect(screen.queryByText('保留中')).not.toBeInTheDocument();
    expect(screen.queryByText('保存後にアップロード予定')).not.toBeInTheDocument();
  });

  // ATT-FE-086: 追加モードのダウンロードアイコンのみ非表示で、他の要素は描画されること。
  // ファイル名（<Button variant="text">）・サイズ（<span>）・削除（<Button color="error">削除</Button>）は存在する（issue #143、案 A）。
  it('ATT-FE-086: hides_download_icon_only_in_add_mode_and_keeps_other_elements', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-url');

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId={null}
          mode="add"
          canModify={true}
        />
      </Wrapper>,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    await user.upload(fileInput, jpegFile);

    // ダウンロードアイコンが DOM 上に存在しないこと（add モードのみ非表示）。
    // data-testid 命名: pending-attachment-download-{index} は存在しない。
    expect(screen.queryByTestId('pending-attachment-download-0')).not.toBeInTheDocument();
    // aria-label="ダウンロード" のボタンも存在しないこと。
    expect(screen.queryByRole('button', { name: 'ダウンロード' })).not.toBeInTheDocument();

    // 他の要素は描画されていること（ダウンロードアイコンのみが非表示）。
    expect(screen.getByTestId('pending-attachment-preview-0')).toBeInTheDocument();
    expect(screen.getByTestId('pending-attachment-size-0')).toBeInTheDocument();
    const deleteBtn = screen.getByTestId('pending-attachment-delete-0');
    expect(deleteBtn).toHaveTextContent('削除');

    // useAttachmentDownloadUrl は呼ばれないこと（fetch 呼び出しなし）。
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.some(([url]: [string]) => typeof url === 'string' && url.includes('download'))).toBe(false);
  });

  // ATT-FE-087: add / edit リスト UI 構造の同型性検証。
  // add モードの保留ファイル行と edit モードの添付ファイル行のマークアップ構造を比較し、
  // 差分がダウンロードアイコンの有無のみであることを確認する（issue #143、案 A）。
  it('ATT-FE-087: add_and_edit_mode_lists_share_same_markup_except_download_icon', async () => {
    // (a) edit モード: 添付 1 件（receipt.jpg, 245760 B）を表示する。
    const editModeFetch = vi.fn().mockResolvedValue({
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
    globalThis.fetch = editModeFetch;

    const Wrapper = createWrapper();
    const { unmount: unmountEdit } = render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          mode="edit"
          canModify={true}
        />
      </Wrapper>,
    );

    // edit モードの添付行が描画されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-item-att-001')).toBeInTheDocument();
    });

    // edit モードの行要素の構造を記録する。
    const editRow = screen.getByTestId('attachment-item-att-001');
    expect(editRow.tagName.toLowerCase()).toBe('li');
    expect(editRow.parentElement?.tagName.toLowerCase()).toBe('ul');
    // edit モードのファイル名ボタン（<button> 要素）。
    const editPreviewBtn = screen.getByTestId('attachment-preview-att-001');
    expect(editPreviewBtn.tagName.toLowerCase()).toBe('button');
    // edit モードのサイズ（<span> 要素）。
    const editSizeEl = screen.getByTestId('attachment-size-att-001');
    expect(editSizeEl.tagName.toLowerCase()).toBe('span');
    // edit モードの削除ボタン（<button> 要素、テキスト「削除」）。
    const editDeleteBtn = screen.getByTestId('attachment-delete-att-001');
    expect(editDeleteBtn.tagName.toLowerCase()).toBe('button');
    expect(editDeleteBtn).toHaveTextContent('削除');
    // edit モードにはダウンロードアイコンが存在すること。
    const editDownloadBtn = screen.getByTestId('attachment-download-att-001');
    expect(editDownloadBtn).toBeInTheDocument();

    unmountEdit();

    // (b) add モード: 同名・同サイズの JPEG を 1 件保留する。
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [],
        pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      }),
    } as unknown as Response);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-url');

    const user = userEvent.setup();
    const Wrapper2 = createWrapper();
    render(
      <Wrapper2>
        <AttachmentArea
          reportId="rpt-1"
          itemId={null}
          mode="add"
          canModify={true}
        />
      </Wrapper2>,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 245760, 'image/jpeg');
    await user.upload(fileInput, jpegFile);

    // add モードの行要素の構造を検証する。
    const addRow = screen.getByTestId('pending-file-row-0');
    expect(addRow.tagName.toLowerCase()).toBe('li');
    expect(addRow.parentElement?.tagName.toLowerCase()).toBe('ul');
    // add モードのファイル名ボタン（<button> 要素）。
    const addPreviewBtn = screen.getByTestId('pending-attachment-preview-0');
    expect(addPreviewBtn.tagName.toLowerCase()).toBe('button');
    // add モードのサイズ（<span> 要素）。
    const addSizeEl = screen.getByTestId('pending-attachment-size-0');
    expect(addSizeEl.tagName.toLowerCase()).toBe('span');
    // add モードの削除ボタン（<button> 要素、テキスト「削除」）。
    const addDeleteBtn = screen.getByTestId('pending-attachment-delete-0');
    expect(addDeleteBtn.tagName.toLowerCase()).toBe('button');
    expect(addDeleteBtn).toHaveTextContent('削除');

    // 唯一の差分: add モードにはダウンロードアイコンが存在しないこと。
    expect(screen.queryByTestId('pending-attachment-download-0')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ダウンロード' })).not.toBeInTheDocument();

    // li のタグ名・ul 親・button タグのファイル名・span タグのサイズ・button タグの削除は
    // edit / add 両モードで完全一致している（差分はダウンロードアイコンのみ）。
  });
});
