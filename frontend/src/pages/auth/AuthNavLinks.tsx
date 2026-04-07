// 認証画面下部のナビゲーションリンクを表示するコンポーネント。
// ログイン・サインアップ・パスワードリセット画面で共有される。

import { Link } from 'react-router-dom';

/** ナビゲーションリンクの定義。 */
export interface AuthNavLink {
  /** リンクの前に表示するテキスト（例: "アカウントをお持ちでない方は"）。 */
  prefix: string;
  /** リンクテキスト（例: "新規登録"）。 */
  label: string;
  /** リンク先のパス（例: "/signup"）。 */
  to: string;
}

export interface AuthNavLinksProps {
  /** 表示するナビゲーションリンクの配列。 */
  links: AuthNavLink[];
}

/**
 * AuthNavLinks は認証画面下部のナビゲーションリンクを描画する。
 * 各リンクは prefix テキストとリンクテキストのペアで構成される。
 */
export default function AuthNavLinks({ links }: AuthNavLinksProps) {
  // 未実装スタブ。実装後に MUI Typography + Link を使用する。
  return (
    <nav data-testid="auth-nav-links">
      {links.map((link) => (
        <div key={link.to}>
          <span>{link.prefix}</span>
          <Link to={link.to}>{link.label}</Link>
        </div>
      ))}
    </nav>
  );
}
