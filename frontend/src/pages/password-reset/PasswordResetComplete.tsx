// パスワードリセット完了コンポーネント。
// パスワード変更完了メッセージとログイン画面へのリンクを表示する。

import { Link } from 'react-router-dom';

/**
 * PasswordResetComplete はパスワード変更完了画面を描画する。
 * ログイン画面へのリンクを含む。
 * 未実装スタブ。
 */
export default function PasswordResetComplete() {
  return (
    <div data-testid="password-reset-complete">
      <p>パスワードが変更されました。</p>
      <Link to="/login">ログイン画面へ</Link>
    </div>
  );
}
