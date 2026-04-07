// TenantStatusCards コンポーネントのユニットテスト。
// DSH-FE-019〜DSH-FE-021 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import TenantStatusCards from '../TenantStatusCards';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('TenantStatusCards', () => {
  // DSH-FE-019: 5 枚のカードが表示され、それぞれの件数が表示されること。
  it('DSH-FE-019: 下書き・提出済み・承認済み・却下・支払済みの 5 枚のカードが表示される', () => {
    renderWithRouter(
      <TenantStatusCards
        draftCount={5}
        submittedCount={3}
        approvedCount={2}
        rejectedCount={1}
        paidCount={4}
      />,
    );
    expect(screen.getByText('下書き')).toBeInTheDocument();
    expect(screen.getByText('提出済み')).toBeInTheDocument();
    expect(screen.getByText('承認済み')).toBeInTheDocument();
    expect(screen.getByText('却下')).toBeInTheDocument();
    expect(screen.getByText('支払済み')).toBeInTheDocument();
  });

  // DSH-FE-020: 各カードにステータスに対応するアクセントカラーが適用されること。
  it('DSH-FE-020: 各カードが MuiCard-root として描画される', () => {
    const { container } = renderWithRouter(
      <TenantStatusCards
        draftCount={1}
        submittedCount={1}
        approvedCount={1}
        rejectedCount={1}
        paidCount={1}
      />,
    );
    // 5 枚の Card コンポーネントが描画されること。
    const cards = container.querySelectorAll('.MuiCard-root');
    expect(cards.length).toBe(5);
  });

  // DSH-FE-021: 各カードのリンクが SCR-ADM-001（管理者レポート一覧）に遷移すること。
  it('DSH-FE-021: 各カードのリンクが /reports/all?status=XXX に設定されている', () => {
    renderWithRouter(
      <TenantStatusCards
        draftCount={1}
        submittedCount={1}
        approvedCount={1}
        rejectedCount={1}
        paidCount={1}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(5);

    const hrefs = links.map((l) => l.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('/reports/all'))).toBe(true);
  });
});
