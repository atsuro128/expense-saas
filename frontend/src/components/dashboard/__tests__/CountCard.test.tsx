// CountCard コンポーネントのユニットテスト。
// DSH-FE-008〜DSH-FE-015 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, it, expect } from 'vitest';
import CountCard from '../CountCard';

const theme = createTheme();

/** テストで MemoryRouter + ThemeProvider を提供するヘルパー。 */
function renderWithRouter(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
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

  // DSH-FE-014: accentColor ごとに正しい borderColor が視覚的に適用されること。
  it.each([
    { color: 'info' as const, label: '提出済み', paletteKey: 'info' as const },
    { color: 'success' as const, label: '承認済み', paletteKey: 'success' as const },
    { color: 'error' as const, label: '却下', paletteKey: 'error' as const },
    { color: 'secondary' as const, label: '支払済み', paletteKey: 'secondary' as const },
  ])('DSH-FE-014: accentColor="$color" で borderColor が theme.palette.$paletteKey.main になる', ({ color, label, paletteKey }) => {
    const { container } = renderWithRouter(<CountCard label={label} count={2} accentColor={color} />);
    const card = container.querySelector('.MuiCard-root') as HTMLElement;
    expect(card).toBeInTheDocument();
    // MUI sx prop により borderColor が theme.palette[paletteKey].main の色値に解決されること。
    const expectedColor = theme.palette[paletteKey].main;
    expect(card.style.borderColor).toBe(expectedColor);
  });

  // DSH-FE-014: accentColor="default" のとき borderTop が適用されないこと。
  it('DSH-FE-014: accentColor="default" で borderTop が適用されない', () => {
    const { container } = renderWithRouter(<CountCard label="下書き" count={2} accentColor="default" />);
    const card = container.querySelector('.MuiCard-root') as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.style.borderTop).toBe('');
  });

  // DSH-FE-015: unit="人" を指定したとき「人」で表示されること。
  it('DSH-FE-015: unit="人" を指定したとき単位が「人」で表示される', () => {
    renderWithRouter(<CountCard label="メンバー数" count={10} unit="人" />);
    expect(screen.getByText('人')).toBeInTheDocument();
    expect(screen.queryByText('件')).not.toBeInTheDocument();
  });
});
