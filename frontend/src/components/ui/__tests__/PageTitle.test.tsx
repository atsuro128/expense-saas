// PageTitle コンポーネントのユニットテスト。
// TNT-FE-042, TNT-FE-043 に対応する。

import { render, screen } from '@testing-library/react';
import { describe, it } from 'vitest';
import PageTitle from '../PageTitle';

describe('PageTitle', () => {
  // TNT-FE-042: title="テナント情報" を渡すとページタイトルが描画されること。
  it('TNT-FE-042: title="テナント情報" を渡すとページタイトルが描画される', () => {
    render(<PageTitle title="テナント情報" />);

    // 「テナント情報」がページタイトルとして描画されること。
    expect(screen.getByRole('heading', { name: 'テナント情報' })).toBeInTheDocument();
  });

  // TNT-FE-043: title="全レポート一覧" を渡すとページタイトルが描画されること。
  it('TNT-FE-043: title="全レポート一覧" を渡すとページタイトルが描画される', () => {
    render(<PageTitle title="全レポート一覧" />);

    // 「全レポート一覧」がページタイトルとして描画されること。
    expect(screen.getByRole('heading', { name: '全レポート一覧' })).toBeInTheDocument();
  });
});
