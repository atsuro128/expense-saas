// MyReportCountCards コンポーネントのユニットテスト。
// DSH-FE-016〜DSH-FE-018 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import MyReportCountCards from '../MyReportCountCards';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('MyReportCountCards', () => {
  // DSH-FE-016: 3 枚のカードが表示され、それぞれの件数が表示されること。
  it('DSH-FE-016: 下書き・提出中・却下の 3 枚のカードが件数付きで表示される', () => {
    renderWithRouter(
      <MyReportCountCards draftCount={2} submittedCount={1} rejectedCount={1} />,
    );
    expect(screen.getByText('下書き')).toBeInTheDocument();
    expect(screen.getByText('提出中')).toBeInTheDocument();
    expect(screen.getByText('却下')).toBeInTheDocument();

    // 件数が正しく表示されること（複数の「1」が存在するため getAllByText を使用）。
    const counts = screen.getAllByText(/^[012]$/);
    expect(counts.length).toBeGreaterThanOrEqual(3);
  });

  // DSH-FE-017: 全件数 0 でも 3 枚のカードが表示されること。
  it('DSH-FE-017: 全件数 0 でも 3 枚のカードが表示される', () => {
    renderWithRouter(
      <MyReportCountCards draftCount={0} submittedCount={0} rejectedCount={0} />,
    );
    expect(screen.getByText('下書き')).toBeInTheDocument();
    expect(screen.getByText('提出中')).toBeInTheDocument();
    expect(screen.getByText('却下')).toBeInTheDocument();
  });

  // DSH-FE-018: 各カードのリンクが正しいステータスフィルタのパスに遷移すること。
  it('DSH-FE-018: 下書きカードのリンクが /reports?status=draft に設定されている', () => {
    renderWithRouter(
      <MyReportCountCards draftCount={2} submittedCount={1} rejectedCount={1} />,
    );
    const links = screen.getAllByRole('link');
    const draftLink = links.find((l) => l.getAttribute('href')?.includes('status=draft'));
    const submittedLink = links.find((l) => l.getAttribute('href')?.includes('status=submitted'));
    const rejectedLink = links.find((l) => l.getAttribute('href')?.includes('status=rejected'));

    expect(draftLink).toBeInTheDocument();
    expect(submittedLink).toBeInTheDocument();
    expect(rejectedLink).toBeInTheDocument();
  });
});
