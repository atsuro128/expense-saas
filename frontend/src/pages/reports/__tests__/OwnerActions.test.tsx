// OwnerActions コンポーネントのユニットテスト。
// RPT-FE-088〜096 に対応する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import OwnerActions from '../OwnerActions';

describe('OwnerActions', () => {
  // RPT-FE-088: status="draft"、itemCount=1 のとき編集・提出・削除ボタンが表示される。
  it('RPT-FE-088: status="draft" + itemCount=1 のとき編集・提出・削除ボタンが表示される', () => {
    render(<OwnerActions status="draft" itemCount={1} />);

    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提出' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument();
  });

  // RPT-FE-089: status="draft"、itemCount=0 のとき提出ボタンが disabled + ツールチップ表示。
  it('RPT-FE-089: status="draft" + itemCount=0 のとき提出ボタンが disabled', () => {
    render(<OwnerActions status="draft" itemCount={0} />);

    const submitButton = screen.getByRole('button', { name: '提出' });
    expect(submitButton).toBeDisabled();
    // ツールチップのテキストが title 属性として設定されていること
    expect(submitButton).toHaveAttribute('title');
  });

  // RPT-FE-090: status="rejected" のとき再申請ボタンが表示される。編集・提出・削除は非表示。
  it('RPT-FE-090: status="rejected" のとき再申請ボタンが表示される', () => {
    render(<OwnerActions status="rejected" />);

    expect(screen.getByRole('button', { name: '再申請' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提出' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
  });

  // RPT-FE-091: status="submitted" のとき全ボタンが非表示。
  it('RPT-FE-091: status="submitted" のとき全ボタンが非表示', () => {
    const { container } = render(<OwnerActions status="submitted" />);

    expect(container.firstChild).toBeNull();
  });

  // RPT-FE-092: status="draft" + 編集ボタンクリックで onEdit コールバックが呼ばれる。
  it('RPT-FE-092: 編集ボタンをクリックすると onEdit が呼ばれる', async () => {
    const onEdit = vi.fn();
    render(<OwnerActions status="draft" itemCount={1} onEdit={onEdit} />);

    await userEvent.click(screen.getByRole('button', { name: '編集' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  // RPT-FE-093: status="draft" + itemCount=1 + 提出ボタンクリックで onSubmitReport コールバックが呼ばれる。
  it('RPT-FE-093: 提出ボタンをクリックすると onSubmitReport が呼ばれる', async () => {
    const onSubmitReport = vi.fn();
    render(<OwnerActions status="draft" itemCount={1} onSubmitReport={onSubmitReport} />);

    await userEvent.click(screen.getByRole('button', { name: '提出' }));

    expect(onSubmitReport).toHaveBeenCalledTimes(1);
  });

  // RPT-FE-094: status="draft" + 削除ボタンクリックで onDelete コールバックが呼ばれる。
  it('RPT-FE-094: 削除ボタンをクリックすると onDelete が呼ばれる', async () => {
    const onDelete = vi.fn();
    render(<OwnerActions status="draft" itemCount={1} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: '削除' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  // RPT-FE-095: status="rejected" + 再申請ボタンクリックで onResubmit コールバックが呼ばれる。
  it('RPT-FE-095: 再申請ボタンをクリックすると onResubmit が呼ばれる', async () => {
    const onResubmit = vi.fn();
    render(<OwnerActions status="rejected" onResubmit={onResubmit} />);

    await userEvent.click(screen.getByRole('button', { name: '再申請' }));

    expect(onResubmit).toHaveBeenCalledTimes(1);
  });

  // RPT-FE-096: pendingAction="submit" のとき提出ボタンが disabled + スピナー。編集・削除ボタンも disabled。
  it('RPT-FE-096: pendingAction="submit" のとき提出ボタンが disabled + スピナー表示', () => {
    render(<OwnerActions status="draft" itemCount={1} pendingAction="submit" />);

    const submitButton = screen.getByRole('button', { name: '提出' });
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();

    // 編集・削除ボタンも disabled であること
    expect(screen.getByRole('button', { name: '編集' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '削除' })).toBeDisabled();
  });
});
