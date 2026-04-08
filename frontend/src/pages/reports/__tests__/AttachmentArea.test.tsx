// AttachmentArea コンポーネントのユニットテスト。
// report-detail.md §AttachmentArea の Props 仕様に基づくテスト。
// ATT-FE-060〜064 に対応する。

import { render, screen } from '@testing-library/react';
import AttachmentArea from '../AttachmentArea';

describe('AttachmentArea', () => {
  // ATT-FE-060: itemId=null のとき非表示になる（追加モードで明細未保存）。
  it('ATT-FE-060: itemId=null のとき null を返す（非表示）', () => {
    const { container } = render(
      <AttachmentArea
        reportId="report-001"
        itemId={null}
        canModify={true}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  // ATT-FE-061: itemId が設定されているとき添付エリアが表示される。
  it('ATT-FE-061: itemId が設定されているとき添付エリアが表示される', () => {
    render(
      <AttachmentArea
        reportId="report-001"
        itemId="item-001"
        canModify={true}
      />,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
  });

  // ATT-FE-062: canModify=true のとき添付エリアが表示される（変更操作可能）。
  it('ATT-FE-062: canModify=true（所有者 AND draft）のとき添付エリアが表示される', () => {
    render(
      <AttachmentArea
        reportId="report-001"
        itemId="item-001"
        canModify={true}
      />,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
  });

  // ATT-FE-063: canModify=false のとき添付エリアが表示される（閲覧のみ）。
  it('ATT-FE-063: canModify=false（非所有者・draft 以外）のとき添付エリアが表示される（閲覧のみ）', () => {
    render(
      <AttachmentArea
        reportId="report-001"
        itemId="item-001"
        canModify={false}
      />,
    );

    // canModify=false でも itemId が設定されていれば添付エリアは表示される
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
  });

  // ATT-FE-064: reportId と itemId の両方が設定されているとき添付エリアが表示される。
  it('ATT-FE-064: reportId と itemId の両方が設定されているとき添付エリアが描画される', () => {
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
