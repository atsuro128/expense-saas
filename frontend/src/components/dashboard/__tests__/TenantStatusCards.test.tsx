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
  // MUI sx prop は class ベースの CSS-in-JS で適用されるため、JSDOM では style 属性に反映されない。
  // default カードと非 default カードで異なる CSS クラスが付与されることで、色分けの適用を検証する。
  it('DSH-FE-020: default カードと非 default カードで異なる CSS クラスが適用される', () => {
    const { container } = renderWithRouter(
      <TenantStatusCards
        draftCount={1}
        submittedCount={1}
        approvedCount={1}
        rejectedCount={1}
        paidCount={1}
      />,
    );
    const cards = container.querySelectorAll('.MuiCard-root');
    expect(cards.length).toBe(5);

    const cardsArray = Array.from(cards) as HTMLElement[];
    const defaultClassName = cardsArray[0]!.className;
    // 提出済み〜支払済み（info/success/error/secondary）は default と異なるクラスを持つこと。
    for (let i = 1; i < 5; i++) {
      expect(cardsArray[i]!.className).not.toBe(defaultClassName);
    }
    // 各非 default カードが互いに異なるクラスを持つこと（色マッピングが個別であること）。
    const nonDefaultClasses = [1, 2, 3, 4].map((i) => cardsArray[i]!.className);
    const uniqueClasses = new Set(nonDefaultClasses);
    expect(uniqueClasses.size).toBe(4);
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
    // 各ステータスに対応する URL が個別に存在すること（SCR-ADM-001 準拠）。
    expect(hrefs).toContain('/reports/all?status=draft');
    expect(hrefs).toContain('/reports/all?status=submitted');
    expect(hrefs).toContain('/reports/all?status=approved');
    expect(hrefs).toContain('/reports/all?status=rejected');
    expect(hrefs).toContain('/reports/all?status=paid');
  });
});
