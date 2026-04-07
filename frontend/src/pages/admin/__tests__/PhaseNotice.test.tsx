// PhaseNotice のユニットテスト。
// TNT-FE-012 に対応する。

import { render, screen } from '@testing-library/react';
import { describe, it } from 'vitest';
import PhaseNotice from '../PhaseNotice';

describe('PhaseNotice', () => {
  // TNT-FE-012: message が渡された場合、メッセージが描画されること。
  it('TNT-FE-012: message を渡すと指定したメッセージテキストが描画される', () => {
    const message = 'テナント情報の編集機能は今後追加予定です。';

    render(<PhaseNotice message={message} />);

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
