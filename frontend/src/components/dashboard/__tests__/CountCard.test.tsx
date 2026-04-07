// CountCard コンポーネントのユニットテスト。
// DSH-FE-008〜DSH-FE-015 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, it, expect } from 'vitest';
import CountCard from '../CountCard';

// テスト用テーマ: theme.ts と同一設定を使用する。
const testTheme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
});

/** テストで MemoryRouter と ThemeProvider を提供するヘルパー。 */
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={testTheme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}

/**
 * Emotion が document に注入した全 style タグのテキストを返す。
 * MUI v6 + Emotion は data-emotion 属性を持つ style タグにスタイルを注入する。
 */
function getInjectedStyles(): string {
  return Array.from(document.querySelectorAll('style[data-emotion]'))
    .map((el) => el.textContent ?? '')
    .join('\n');
}

describe('CountCard', () => {
  // DSH-FE-008: label と count が表示され、デフォルト単位「件」が表示されること。
  it('DSH-FE-008: label と count が表示され、単位「件」がデフォルトで表示される', () => {
    renderWithProviders(<CountCard label="下書き" count={5} />);
    expect(screen.getByText('下書き')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('件')).toBeInTheDocument();
  });

  // DSH-FE-009: href 指定時にリンクとしてレンダリングされること。
  it('DSH-FE-009: href 指定時はカードがリンクとしてレンダリングされる', () => {
    renderWithProviders(<CountCard label="下書き" count={3} href="/reports?status=draft" />);
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/reports?status=draft');
  });

  // DSH-FE-010: href なしのとき link 要素が存在しないこと。
  it('DSH-FE-010: href なしのとき link 要素は存在しない', () => {
    renderWithProviders(<CountCard label="メンバー数" count={10} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  // DSH-FE-011: count が 0 のときもカードが表示され「0」が表示されること。
  it('DSH-FE-011: count=0 でもカードが表示され「0」が表示される', () => {
    renderWithProviders(<CountCard label="却下" count={0} />);
    expect(screen.getByText('却下')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  // DSH-FE-012: showBadge=true かつ count >= 1 のとき要対応バッジが表示されること。
  it('DSH-FE-012: showBadge=true かつ count >= 1 のときバッジが表示される', () => {
    const { container } = renderWithProviders(<CountCard label="承認待ち" count={3} showBadge={true} />);
    // MUI Badge は dot バリアントで badge を出力する。
    const badge = container.querySelector('.MuiBadge-badge');
    expect(badge).toBeInTheDocument();
  });

  // DSH-FE-013: showBadge=true かつ count=0 のときバッジが表示されないこと。
  it('DSH-FE-013: showBadge=true かつ count=0 のときバッジが表示されない', () => {
    const { container } = renderWithProviders(<CountCard label="承認待ち" count={0} showBadge={true} />);
    // count が 0 の場合、Badge を使わない実装のためバッジ要素が存在しない。
    const badge = container.querySelector('.MuiBadge-badge');
    expect(badge).not.toBeInTheDocument();
  });

  // DSH-FE-014: accentColor ごとに正しいパレットカラーが borderColor に適用されること。
  // ThemeProvider でラップし、Emotion が注入した style タグから期待する色コードを検証する。
  // 各 accentColor に対応する MUI palette の main 色が CSS に含まれることを確認することで、
  // 色を入れ替えた場合にテストが失敗することを保証する。
  it.each([
    // MUI v6 デフォルトテーマのパレット色コード（info/success/error）と
    // theme.ts で定義したカスタム色（secondary）を使用する。
    { color: 'info' as const, label: '提出済み', expectedHex: '#0288d1' },
    { color: 'success' as const, label: '承認済み', expectedHex: '#2e7d32' },
    { color: 'error' as const, label: '却下', expectedHex: '#d32f2f' },
    { color: 'secondary' as const, label: '支払済み', expectedHex: '#dc004e' },
  ])(
    'DSH-FE-014: accentColor="$color" で $expectedHex が borderColor として CSS に注入される',
    ({ color, label, expectedHex }) => {
      renderWithProviders(<CountCard label={label} count={2} accentColor={color} />);
      // Emotion が生成した style タグに、対応する palette.main 色コードが含まれることを検証する。
      // CountCard 実装: borderColor: `${accentColor}.main` → MUI が解決して実際の色コードに変換。
      const styles = getInjectedStyles();
      expect(styles).toContain(expectedHex);
    },
  );

  // DSH-FE-014: accentColor="default" のとき borderTop 用のスタイルが適用されないこと。
  // default と info で生成される CSS クラスが異なることを検証する。
  it('DSH-FE-014: accentColor="default" で borderTop 用の追加スタイルが適用されない', () => {
    const { container: defaultContainer } = renderWithProviders(
      <CountCard label="下書き" count={2} accentColor="default" />,
    );
    const { container: infoContainer } = renderWithProviders(
      <CountCard label="提出済み" count={2} accentColor="info" />,
    );
    const defaultCard = defaultContainer.querySelector('.MuiCard-root') as HTMLElement;
    const infoCard = infoContainer.querySelector('.MuiCard-root') as HTMLElement;
    // default と info で異なる CSS クラスが適用されること（borderTop/borderColor の有無）。
    expect(defaultCard.className).not.toBe(infoCard.className);
  });

  // DSH-FE-015: unit="人" を指定したとき「人」で表示されること。
  it('DSH-FE-015: unit="人" を指定したとき単位が「人」で表示される', () => {
    renderWithProviders(<CountCard label="メンバー数" count={10} unit="人" />);
    expect(screen.getByText('人')).toBeInTheDocument();
    expect(screen.queryByText('件')).not.toBeInTheDocument();
  });
});
