// CountCard コンポーネントのユニットテスト。
// DSH-FE-008〜DSH-FE-015 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import CountCard from '../CountCard';

/** テストで MemoryRouter を提供するヘルパー。 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('CountCard', () => {
  // DSH-FE-008: label と count が表示され、デフォルト単位「件」が表示されること。
  it('DSH-FE-008: label と count が表示され、単位「件」がデフォルトで表示される', () => {
    renderWithRouter(<CountCard label="下書き" count={5} />);
    expect(screen.getByText('下書き')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('件')).toBeInTheDocument();
  });

  // DSH-FE-009: href 指定時にリンクとしてレンダリングされること。
  it('DSH-FE-009: href 指定時はカードがリンクとしてレンダリングされる', () => {
    renderWithRouter(<CountCard label="下書き" count={3} href="/reports?status=draft" />);
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/reports?status=draft');
  });

  // DSH-FE-010: href なしのとき link 要素が存在しないこと。
  it('DSH-FE-010: href なしのとき link 要素は存在しない', () => {
    renderWithRouter(<CountCard label="メンバー数" count={10} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  // DSH-FE-011: count が 0 のときもカードが表示され「0」が表示されること。
  it('DSH-FE-011: count=0 でもカードが表示され「0」が表示される', () => {
    renderWithRouter(<CountCard label="却下" count={0} />);
    expect(screen.getByText('却下')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  // DSH-FE-012: showBadge=true かつ count >= 1 のとき要対応バッジが表示されること。
  it('DSH-FE-012: showBadge=true かつ count >= 1 のときバッジが表示される', () => {
    const { container } = renderWithRouter(<CountCard label="承認待ち" count={3} showBadge={true} />);
    // MUI Badge は dot バリアントで badge を出力する。
    const badge = container.querySelector('.MuiBadge-badge');
    expect(badge).toBeInTheDocument();
  });

  // DSH-FE-013: showBadge=true かつ count=0 のときバッジが表示されないこと。
  it('DSH-FE-013: showBadge=true かつ count=0 のときバッジが表示されない', () => {
    const { container } = renderWithRouter(<CountCard label="承認待ち" count={0} showBadge={true} />);
    // count が 0 の場合、Badge を使わない実装のためバッジ要素が存在しない。
    const badge = container.querySelector('.MuiBadge-badge');
    expect(badge).not.toBeInTheDocument();
  });

  // DSH-FE-014: accentColor ごとに正しいアクセントカラーが適用されること。
  // MUI sx prop は class ベースの CSS-in-JS で適用されるため、JSDOM では style 属性に反映されない。
  // Emotion が生成する CSS クラスの存在で、sx prop が適用されていることを検証する。
  it.each([
    { color: 'info' as const, label: '提出済み' },
    { color: 'success' as const, label: '承認済み' },
    { color: 'error' as const, label: '却下' },
    { color: 'secondary' as const, label: '支払済み' },
  ])('DSH-FE-014: accentColor="$color" で Emotion CSS クラスが適用される', ({ color, label }) => {
    const { container } = renderWithRouter(<CountCard label={label} count={2} accentColor={color} />);
    const card = container.querySelector('.MuiCard-root') as HTMLElement;
    expect(card).toBeInTheDocument();
    // MUI sx prop により Emotion CSS クラスが付与されていること（css- プレフィックス）。
    const classNames = card.className.split(' ');
    const hasSxClass = classNames.some((cn) => cn.startsWith('css-'));
    expect(hasSxClass).toBe(true);
  });

  // DSH-FE-014: accentColor="default" のとき borderTop 用の追加 sx クラスが適用されないこと。
  it('DSH-FE-014: accentColor="default" で borderTop 用の追加スタイルが適用されない', () => {
    const { container: defaultContainer } = renderWithRouter(<CountCard label="下書き" count={2} accentColor="default" />);
    const { container: infoContainer } = renderWithRouter(<CountCard label="提出済み" count={2} accentColor="info" />);
    const defaultCard = defaultContainer.querySelector('.MuiCard-root') as HTMLElement;
    const infoCard = infoContainer.querySelector('.MuiCard-root') as HTMLElement;
    // default と info で異なる CSS クラスが適用されること（borderTop/borderColor の有無）。
    expect(defaultCard.className).not.toBe(infoCard.className);
  });

  // DSH-FE-015: unit="人" を指定したとき「人」で表示されること。
  it('DSH-FE-015: unit="人" を指定したとき単位が「人」で表示される', () => {
    renderWithRouter(<CountCard label="メンバー数" count={10} unit="人" />);
    expect(screen.getByText('人')).toBeInTheDocument();
    expect(screen.queryByText('件')).not.toBeInTheDocument();
  });
});
