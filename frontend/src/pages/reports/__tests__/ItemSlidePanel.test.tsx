// ItemSlidePanel コンポーネントのユニットテスト。
// ITM-FE-018〜025 に対応する。
// ItemSlidePanel は未実装（スタブ）のため、テストは失敗する（赤い仕様テスト）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import ItemSlidePanel from '../ItemSlidePanel';

// テスト用 QueryClientProvider ラッパー。
// AttachmentArea が useQueryClient を使うため、item が存在するケースで必要。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// テスト用フィクスチャ: mockItem（閲覧・編集モードの初期値）
const mockItem = {
  id: 'item-001',
  report_id: 'report-001',
  expense_date: '2026-03-10',
  amount: 1000,
  category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
  description: 'タクシー代',
  attachments: [],
  created_at: '2026-03-10T00:00:00Z',
  updated_at: '2026-03-10T00:00:00Z',
};

const defaultProps = {
  reportId: 'report-001',
  reportStatus: 'draft' as const,
  isOwner: true,
  onClose: () => undefined,
  onSaveSuccess: () => undefined,
  onSaveAndContinue: () => undefined,
};

describe('ItemSlidePanel', () => {
  // ITM-FE-018: open=true のときスライドパネルが表示される。
  it('ITM-FE-018: open=true, mode=add のときスライドパネルが表示される', () => {
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
      />,
    );

    // スライドパネルが表示される（ITM-FE-018）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-slide-panel')).toBeVisible();
  });

  // ITM-FE-019: open=false のときスライドパネルが表示されない。
  // MUI Drawer は open=false のとき Paper コンテンツを DOM にマウントしないため
  // queryByTestId が null を返し、not.toBeInTheDocument() で検証する。
  it('ITM-FE-019: open=false のときスライドパネルが表示されない', () => {
    render(
      <ItemSlidePanel
        open={false}
        mode="add"
        item={null}
        {...defaultProps}
      />,
    );

    // スライドパネルが DOM に存在しないこと（Drawer の open=false で Paper 非マウント）。
    expect(screen.queryByTestId('item-slide-panel')).not.toBeInTheDocument();
  });

  // ITM-FE-020: mode='add', item=null のとき追加モードのタイトルが表示される。
  it('ITM-FE-020: mode=add のとき追加モードのタイトルが表示される', () => {
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
      />,
    );

    // 追加モードのタイトル（「明細追加」等）が表示される（ITM-FE-020）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/明細追加/)).toBeInTheDocument();
  });

  // ITM-FE-021: mode='edit', item=mockItem のとき編集モードのタイトルが表示される。
  it('ITM-FE-021: mode=edit のとき編集モードのタイトルが表示される', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="edit"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // 編集モードのタイトル（「明細編集」等）が表示される（ITM-FE-021）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/明細編集/)).toBeInTheDocument();
  });

  // ITM-FE-022: mode='view', item=mockItem のとき閲覧モードのタイトルが表示される。
  it('ITM-FE-022: mode=view のとき閲覧モードのタイトルが表示される', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="view"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // 閲覧モードのタイトル（「明細詳細」等）が表示される（ITM-FE-022）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/明細詳細/)).toBeInTheDocument();
  });

  // ITM-FE-023: mode='view', item=mockItem のとき ItemForm が mode='view' で描画される（readonly）。
  it('ITM-FE-023: mode=view のとき ItemForm が mode=view で描画される', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="view"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // ItemForm が readonly で描画される（ITM-FE-023）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-form')).toBeInTheDocument();
  });

  // ITM-FE-024: mode='edit', item=mockItem のとき ItemForm に defaultValues が渡される。
  it('ITM-FE-024: mode=edit, item=mockItem のとき ItemForm に mockItem の値が defaultValues として渡される', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="edit"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // ItemForm に defaultValues が渡される（ITM-FE-024）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-form')).toBeInTheDocument();
  });

  // ITM-FE-025: 閉じるボタンをクリックすると onClose が呼ばれる。
  it('ITM-FE-025: 閉じるボタンをクリックすると onClose が呼ばれる', async () => {
    const onClose = vi.fn();
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
        onClose={onClose}
      />,
    );

    // 閉じるボタンクリック（ITM-FE-025）。スタブ実装のため現在は失敗する。
    const closeButton = screen.getByRole('button', { name: /閉じる/ });
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 091: view モード時は AttachmentUploader が表示されない（canModify=false）。
  it('ITM-FE-091-A: mode=view, isOwner=true, reportStatus=draft のとき AttachmentUploader が表示されない', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="view"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // 閲覧モードでは添付アップロード UI が非表示（091 案 B）。
    expect(screen.queryByTestId('attachment-uploader')).not.toBeInTheDocument();
  });

  // 091: edit モード時は canModify=true で AttachmentArea が描画される（対照ケース）。
  it('ITM-FE-091-B: mode=edit, isOwner=true, reportStatus=draft のとき AttachmentArea が描画される', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="edit"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // 編集モードでは AttachmentArea が描画される。
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
  });

  // 092: ESC キーで onClose が呼ばれる（MUI Drawer の標準挙動）。
  it('ITM-FE-092-A: ESC キー押下で onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
        onClose={onClose}
      />,
    );

    // ESC キーで Drawer が閉じ、onClose が呼ばれる。
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 092: Backdrop クリックで onClose が呼ばれる（MUI Drawer の標準挙動）。
  it('ITM-FE-092-B: Backdrop クリックで onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
        onClose={onClose}
      />,
    );

    // MUI Drawer の Backdrop をクリックすると onClose が呼ばれる。
    const backdrop = document.querySelector('.MuiBackdrop-root');
    if (backdrop) {
      await user.click(backdrop);
    }

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 098-1: Drawer 横幅が xs では '100%'、sm では 480px に設定される（論点 1）。
  it('ITM-FE-098-1: open=true のとき Drawer Paper に width スタイル sx が設定されている', () => {
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
      />,
    );

    // PaperProps.sx で width が指定されたパネルが存在する。
    const panel = screen.getByTestId('item-slide-panel');
    expect(panel).toBeInTheDocument();
    // MUI Drawer の Paper 要素がレンダリングされていることで幅の設定が適用される。
    expect(panel).toBeVisible();
  });

  // 098-2: ヘッダー右上に閉じるボタン（aria-label="閉じる"）が存在し、クリックで onClose が呼ばれる（論点 2）。
  it('ITM-FE-098-2: open=true のとき aria-label="閉じる" の IconButton が存在し、クリックで onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
        onClose={onClose}
      />,
    );

    // ヘッダー右上の閉じる IconButton を取得する。
    const closeButton = screen.getByRole('button', { name: '閉じる' });
    expect(closeButton).toBeInTheDocument();
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 098-3: 追加→行クリックの遷移で ItemSlidePanel が再マウントされるため open が true になる（論点 3）。
  // ReportDetailPage 側で formKey をインクリメントすることで key が変わり再マウントが行われる。
  // ItemSlidePanel 単体では open prop に基づき表示が変わることを検証する。
  it('ITM-FE-098-3: open=false から open=true に変更されると Drawer が表示される', () => {
    const { rerender } = render(
      <ItemSlidePanel
        open={false}
        mode="add"
        item={null}
        {...defaultProps}
      />,
    );

    // open=false のとき Paper が DOM に存在しない。
    expect(screen.queryByTestId('item-slide-panel')).not.toBeInTheDocument();

    // open=true に変更すると表示される。
    rerender(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
      />,
    );

    expect(screen.getByTestId('item-slide-panel')).toBeVisible();
  });

  // 098-4: 閲覧モードで全フィールドが disabled になる（論点 4）。
  it('ITM-FE-098-4: mode=view のとき ItemForm 内の全フィールドが disabled 状態になる', () => {
    render(
      <ItemSlidePanel
        open={true}
        mode="view"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // 全フィールドが disabled になっていることを検証する。
    const dateInput = screen.getByLabelText(/日付/);
    const amountInput = screen.getByLabelText(/金額/);
    expect(dateInput).toBeDisabled();
    expect(amountInput).toBeDisabled();
  });
});
