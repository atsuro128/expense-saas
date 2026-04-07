// FormAlert コンポーネントのユニットテスト。
// AUTH-FE-001〜003 および RPT-FE-037〜038 に対応する。

import { render, screen } from '@testing-library/react';
import FormAlert from '../FormAlert';

describe('FormAlert', () => {
  // AUTH-FE-001: message を指定すると Alert が表示され、指定メッセージが描画されること。
  it('AUTH-FE-001: message を指定すると Alert が表示される', () => {
    render(
      <FormAlert
        message="メールアドレスまたはパスワードが正しくありません"
        severity="error"
      />,
    );
    // Alert コンポーネントが表示されること。
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // 指定メッセージが描画されること。
    expect(
      screen.getByText('メールアドレスまたはパスワードが正しくありません'),
    ).toBeInTheDocument();
  });

  // AUTH-FE-002: message=null のとき Alert が DOM に存在しないこと。
  it('AUTH-FE-002: message=null のとき Alert が DOM に存在しない', () => {
    render(<FormAlert message={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // AUTH-FE-003: severity='warning' で描画されること。
  it('AUTH-FE-003: severity=warning で Alert が warning で描画される', () => {
    render(
      <FormAlert
        message="しばらく待ってから再試行してください"
        severity="warning"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // severity が warning に設定されていること（data 属性で確認）。
    expect(alert).toHaveAttribute('data-severity', 'warning');
  });

  // RPT-FE-037: message="エラーが発生しました" のとき Alert にメッセージが表示される。
  it('RPT-FE-037: message を指定すると Alert にメッセージが表示される', () => {
    render(<FormAlert message="エラーが発生しました" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
  });

  // RPT-FE-038: message=null のときコンポーネントが描画されない（非表示）。
  it('RPT-FE-038: message=null のときコンポーネントが描画されない', () => {
    render(<FormAlert message={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
