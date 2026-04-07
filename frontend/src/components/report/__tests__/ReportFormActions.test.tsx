// ReportFormActions コンポーネントのユニットテスト。
// RPT-FE-043〜045 に対応する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReportFormActions from '../ReportFormActions';

describe('ReportFormActions', () => {
  // RPT-FE-043: submitLabel="作成する"、loading=false のとき「作成する」と「キャンセル」ボタンが描画される。
  it('RPT-FE-043: 「作成する」送信ボタンと「キャンセル」ボタンが描画される', () => {
    const onCancel = vi.fn();
    render(<ReportFormActions submitLabel="作成する" loading={false} onCancel={onCancel} />);

    expect(screen.getByRole('button', { name: '作成する' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  // RPT-FE-044: loading=true のとき送信ボタンが disabled + スピナー表示になる。
  it('RPT-FE-044: loading=true のとき送信ボタンが disabled + スピナー表示になる', () => {
    const onCancel = vi.fn();
    render(<ReportFormActions submitLabel="作成する" loading={true} onCancel={onCancel} />);

    // 送信ボタンが disabled であること
    expect(screen.getByRole('button', { name: '作成する' })).toBeDisabled();
    // スピナーが表示されること（data-testid="spinner" で確認）
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  // RPT-FE-045: キャンセルボタンをクリックすると onCancel コールバックが呼び出される。
  it('RPT-FE-045: キャンセルボタンをクリックすると onCancel が呼び出される', async () => {
    const onCancel = vi.fn();
    render(<ReportFormActions submitLabel="作成する" loading={false} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
