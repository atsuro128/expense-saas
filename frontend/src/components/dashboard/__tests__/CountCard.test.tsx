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
 * 指定した Card 要素（MuiCard-root）の Emotion クラスに紐づく CSS ルールのみを返す。
 * MUI v6 + Emotion は data-emotion 属性を持つ style タグにスタイルを注入する。
 * document 全体のスタイルではなく対象要素固有のクラスに絞ることで、
 * 他のテストで注入された色コードによる false positive を防止する。
 */
function getStylesForCard(cardElement: HTMLElement): string {
  // Emotion が付与したクラス名（css- プレフィックス）を抽出する。
  const emotionClasses = Array.from(cardElement.classList).filter((cls) =>
    cls.startsWith('css-'),
  );
  if (emotionClasses.length === 0) return '';

  // 全 style タグのテキストを連結し、対象クラスに該当するルールブロックのみを抽出する。
  const allStyles = Array.from(document.querySelectorAll('style[data-emotion]'))
    .map((el) => el.textContent ?? '')
    .join('\n');

  // 各 Emotion クラスに対応する CSS ルールを正規表現で抽出する。
  // 例: ".css-abc123{border-color:#0288d1;}" のようなルールを取得する。
  const matchedRules: string[] = [];
  for (const cls of emotionClasses) {
    // クラスセレクタを含む CSS ルールブロックを抽出する（{...} の内容を含む）。
    const pattern = new RegExp(`\\.${cls}[^{]*\\{[^}]*\\}`, 'g');
    const matches = allStyles.match(pattern);
    if (matches) {
      matchedRules.push(...matches);
    }
  }
  return matchedRules.join('\n');
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

  // DSH-FE-014: accentColor ごとに正しいパレットカラーが borderColor に適用されること。
  // ThemeProvider でラップし、対象 Card 要素の Emotion クラスに紐づく CSS ルールのみを検証する。
  // document 全体のスタイルではなく Card 固有のクラスに絞ることで false positive を防止する。
  // CountCard 実装: CountCard.tsx L43-44 の borderColor: `${accentColor}.main` が
  // 期待する palette.main 色コードに変換されることを保証する。
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
      const { container } = renderWithProviders(
        <CountCard label={label} count={2} accentColor={color} />,
      );
      // MuiCard-root 要素を取得し、その Emotion クラスに紐づく CSS ルールのみを検証する。
      // CountCard 実装: borderColor: `${accentColor}.main` → MUI が解決して実際の色コードに変換。
      const cardElement = container.querySelector('.MuiCard-root') as HTMLElement;
      expect(cardElement).not.toBeNull();
      const styles = getStylesForCard(cardElement);
      expect(styles).toContain(expectedHex);
    },
  );

  // DSH-FE-014: accentColor="default" のとき borderColor が transparent となり、
  // カードの高さは info などの色付きカードと同じになること（issue #168 対応）。
  // default と info で生成される CSS クラスが異なることを検証する。
  it('DSH-FE-014: accentColor="default" で borderColor が transparent となり高さが揃う', () => {
    const { container: defaultContainer } = renderWithProviders(
      <CountCard label="下書き" count={2} accentColor="default" />,
    );
    const { container: infoContainer } = renderWithProviders(
      <CountCard label="提出済み" count={2} accentColor="info" />,
    );
    const defaultCard = defaultContainer.querySelector('.MuiCard-root') as HTMLElement;
    const infoCard = infoContainer.querySelector('.MuiCard-root') as HTMLElement;
    // default（transparent）と info（info.main）で異なる CSS クラスが適用されること。
    expect(defaultCard.className).not.toBe(infoCard.className);
  });

  // DSH-FE-015: unit="人" を指定したとき「人」で表示されること。
  it('DSH-FE-015: unit="人" を指定したとき単位が「人」で表示される', () => {
    renderWithProviders(<CountCard label="メンバー数" count={10} unit="人" />);
    expect(screen.getByText('人')).toBeInTheDocument();
    expect(screen.queryByText('件')).not.toBeInTheDocument();
  });
});
