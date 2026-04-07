// SelfLabel コンポーネントのユニットテスト。
// WFL-FE-022〜023（承認待ち一覧コンテキスト）
// WFL-FE-079〜080（支払待ち一覧コンテキスト）に対応する。

import { render, screen } from '@testing-library/react';
import SelfLabel from '../SelfLabel';

describe('SelfLabel', () => {
  // WFL-FE-022: isOwnReport=true のとき「自分」ラベルの Chip が表示される。
  it('WFL-FE-022: renders_self_chip_when_own — isOwnReport=true のとき「自分」ラベルが表示される', () => {
    render(<SelfLabel isOwnReport={true} />);
    // 「自分」テキストの Chip が描画されること。
    expect(screen.getByText('自分')).toBeInTheDocument();
  });

  // WFL-FE-023: isOwnReport=false のとき何も描画されない（null を返す）。
  it('WFL-FE-023: renders_nothing_when_not_own — isOwnReport=false のとき何も描画されない', () => {
    const { container } = render(<SelfLabel isOwnReport={false} />);
    // コンテナが空であること（何も描画されない）。
    expect(container.firstChild).toBeNull();
  });

  // WFL-FE-079: 支払待ち一覧コンテキスト — isOwnReport=true のとき「自分」ラベルが表示される。
  it('WFL-FE-079: payable_shows_self_label_true — isOwnReport=true のとき「自分」ラベルが表示される', () => {
    render(<SelfLabel isOwnReport={true} />);
    expect(screen.getByText('自分')).toBeInTheDocument();
  });

  // WFL-FE-080: 支払待ち一覧コンテキスト — isOwnReport=false のとき「自分」ラベルが表示されない。
  it('WFL-FE-080: payable_hides_self_label_false — isOwnReport=false のとき何も描画されない', () => {
    const { container } = render(<SelfLabel isOwnReport={false} />);
    expect(container.firstChild).toBeNull();
  });
});
