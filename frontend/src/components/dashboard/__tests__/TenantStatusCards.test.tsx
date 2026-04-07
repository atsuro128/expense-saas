// TenantStatusCards コンポーネントのユニットテスト。
// DSH-FE-019〜DSH-FE-021 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TenantStatusCards from '../TenantStatusCards';
import type { CountCardProps } from '../CountCard';

// CountCard をモックし、渡された props を記録する。
// DSH-FE-020: 各ステータスに正しい accentColor が渡されることを props レベルで検証するため。
const capturedProps: CountCardProps[] = [];

vi.mock('../CountCard', () => ({
  default: (props: CountCardProps) => {
    capturedProps.push(props);
    return (
      <div
        data-testid="count-card"
        data-label={props.label}
        data-accent-color={props.accentColor ?? 'default'}
        data-href={props.href ?? ''}
      >
        {props.label}
      </div>
    );
  },
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('TenantStatusCards', () => {
  beforeEach(() => {
    // 各テストの前に capturedProps をリセットする。
    capturedProps.length = 0;
  });

  // DSH-FE-019: 5 枚のカードが表示され、それぞれのラベルが表示されること。
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

  // DSH-FE-020: 各カードにステータスに対応する accentColor が渡されること。
  // props レベルで検証することで、色を入れ替えた場合にテストが確実に失敗する。
  it('DSH-FE-020: 下書きカードに accentColor="default" が渡される', () => {
    renderWithRouter(
      <TenantStatusCards
        draftCount={1}
        submittedCount={1}
        approvedCount={1}
        rejectedCount={1}
        paidCount={1}
      />,
    );
    const draftCard = capturedProps.find((p) => p.label === '下書き');
    expect(draftCard).toBeDefined();
    expect(draftCard?.accentColor ?? 'default').toBe('default');
  });

  it('DSH-FE-020: 提出済みカードに accentColor="info" が渡される', () => {
    renderWithRouter(
      <TenantStatusCards
        draftCount={1}
        submittedCount={1}
        approvedCount={1}
        rejectedCount={1}
        paidCount={1}
      />,
    );
    const submittedCard = capturedProps.find((p) => p.label === '提出済み');
    expect(submittedCard).toBeDefined();
    expect(submittedCard?.accentColor).toBe('info');
  });

  it('DSH-FE-020: 承認済みカードに accentColor="success" が渡される', () => {
    renderWithRouter(
      <TenantStatusCards
        draftCount={1}
        submittedCount={1}
        approvedCount={1}
        rejectedCount={1}
        paidCount={1}
      />,
    );
    const approvedCard = capturedProps.find((p) => p.label === '承認済み');
    expect(approvedCard).toBeDefined();
    expect(approvedCard?.accentColor).toBe('success');
  });

  it('DSH-FE-020: 却下カードに accentColor="error" が渡される', () => {
    renderWithRouter(
      <TenantStatusCards
        draftCount={1}
        submittedCount={1}
        approvedCount={1}
        rejectedCount={1}
        paidCount={1}
      />,
    );
    const rejectedCard = capturedProps.find((p) => p.label === '却下');
    expect(rejectedCard).toBeDefined();
    expect(rejectedCard?.accentColor).toBe('error');
  });

  it('DSH-FE-020: 支払済みカードに accentColor="secondary" が渡される', () => {
    renderWithRouter(
      <TenantStatusCards
        draftCount={1}
        submittedCount={1}
        approvedCount={1}
        rejectedCount={1}
        paidCount={1}
      />,
    );
    const paidCard = capturedProps.find((p) => p.label === '支払済み');
    expect(paidCard).toBeDefined();
    expect(paidCard?.accentColor).toBe('secondary');
  });

  // DSH-FE-021: 各カードのリンクが SCR-ADM-001（管理者レポート一覧）に遷移すること。
  it('DSH-FE-021: 各カードの href が /reports/all?status=XXX に設定されている', () => {
    renderWithRouter(
      <TenantStatusCards
        draftCount={1}
        submittedCount={1}
        approvedCount={1}
        rejectedCount={1}
        paidCount={1}
      />,
    );
    const hrefs = capturedProps.map((p) => p.href ?? '');
    expect(hrefs).toContain('/reports/all?status=draft');
    expect(hrefs).toContain('/reports/all?status=submitted');
    expect(hrefs).toContain('/reports/all?status=approved');
    expect(hrefs).toContain('/reports/all?status=rejected');
    expect(hrefs).toContain('/reports/all?status=paid');
  });
});
