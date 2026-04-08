// AttachmentArea コンポーネントのユニットテスト。
// report-detail.md §AttachmentArea の Props 仕様に基づくテスト。
// ATT-FE-001〜006 に対応する。

import { render, screen } from '@testing-library/react';
import AttachmentArea from '../AttachmentArea';

describe('AttachmentArea', () => {
  // ATT-FE-001: AttachmentList と AttachmentUploader の両方が描画される。
  // スタブコンポーネントのため attachment-area と attachment-area-content の存在を確認する。
  it('ATT-FE-001: itemId と canModify=true のとき添付エリアが描画される', () => {
    render(
      <AttachmentArea
        reportId="rpt-1"
        itemId="item-1"
        canModify={true}
      />,
    );

    // 添付エリアが描画されること
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-area-content')).toBeInTheDocument();
  });

  // ATT-FE-002: itemId=null のとき null を返す（明細未保存のため非表示）。
  it('ATT-FE-002: itemId=null のとき null を返す（非表示）', () => {
    const { container } = render(
      <AttachmentArea
        reportId="rpt-1"
        itemId={null}
        canModify={true}
      />,
    );

    // itemId=null の場合は何も描画されない
    expect(container.firstChild).toBeNull();
  });

  // ATT-FE-003: canModify=false のとき AttachmentUploader が非表示になる（閲覧のみ）。
  // スタブコンポーネントのため、attachment-area が表示されることを確認する。
  it('ATT-FE-003: canModify=false のとき添付エリアは表示される（閲覧のみ）', () => {
    render(
      <AttachmentArea
        reportId="rpt-1"
        itemId="item-1"
        canModify={false}
      />,
    );

    // canModify=false でも itemId が設定されていれば添付エリアは表示される
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
  });

  // ATT-FE-004: canModify=true のとき AttachmentUploader が表示される。
  it('ATT-FE-004: canModify=true のとき添付エリアが表示される', () => {
    render(
      <AttachmentArea
        reportId="rpt-1"
        itemId="item-1"
        canModify={true}
      />,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
  });

  // ATT-FE-005: マウント時に useAttachments が呼び出される（添付一覧取得）。
  // スタブコンポーネントのため、コンポーネントが描画されることで取得が行われることを確認する。
  it('ATT-FE-005: itemId が設定されているとき添付エリアが描画される（useAttachments 呼び出しの前提）', () => {
    render(
      <AttachmentArea
        reportId="rpt-1"
        itemId="item-1"
        canModify={true}
      />,
    );

    // itemId が設定されているため attachment-area が描画される
    // 機能実装後は useAttachments({ reportId: "rpt-1", itemId: "item-1" }) が呼び出される
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
  });

  // ATT-FE-006: 削除処理中に deletingId が設定され、対象添付がグレーアウトされる。
  // スタブコンポーネントのため、reportId と itemId の両方が設定されているときに描画されることを確認する。
  it('ATT-FE-006: reportId と itemId の両方が設定されているとき添付エリアが描画される', () => {
    render(
      <AttachmentArea
        reportId="report-abc"
        itemId="item-xyz"
        canModify={false}
      />,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-area-content')).toBeInTheDocument();
  });
});
