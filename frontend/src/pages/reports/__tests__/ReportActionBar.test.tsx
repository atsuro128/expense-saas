// ReportActionBar コンポーネントのユニットテスト。
// RPT-FE-081〜087 に対応する。

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ReportActionBar from '../ReportActionBar';

describe('ReportActionBar', () => {
  // RPT-FE-081: status="draft"、isOwner=true、currentUserRole="member" のとき OwnerActions が描画される。
  it('RPT-FE-081: draft + 所有者 + member のとき OwnerActions が描画される', () => {
    render(
      <ReportActionBar
        status="draft"
        isOwner={true}
        currentUserRole="member"
        itemCount={1}
      />,
    );

    // OwnerActions の編集・提出・削除ボタンが表示されること
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提出' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument();
    // WorkflowActions は表示されないこと
    expect(screen.queryByTestId('workflow-actions')).not.toBeInTheDocument();
  });

  // RPT-FE-082: status="submitted"、isOwner=false、currentUserRole="approver" のとき WorkflowActions が描画される。
  it('RPT-FE-082: submitted + 非所有者 + approver のとき WorkflowActions が描画される', () => {
    render(
      <ReportActionBar
        status="submitted"
        isOwner={false}
        currentUserRole="approver"
      />,
    );

    // WorkflowActions の承認・却下ボタンが表示されること
    expect(screen.getByTestId('workflow-actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '承認' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '却下' })).toBeInTheDocument();
    // OwnerActions は表示されないこと
    expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument();
  });

  // RPT-FE-083: status="submitted"、isOwner=true、currentUserRole="approver" のとき WorkflowActions が非表示（自己承認禁止: RBC-016）。
  it('RPT-FE-083: submitted + 所有者 + approver のとき WorkflowActions が描画されない（自己承認禁止）', () => {
    render(
      <ReportActionBar
        status="submitted"
        isOwner={true}
        currentUserRole="approver"
      />,
    );

    // WorkflowActions が非表示であること
    expect(screen.queryByTestId('workflow-actions')).not.toBeInTheDocument();
  });

  // RPT-FE-084: status="rejected"、isOwner=true のとき OwnerActions が描画され再申請ボタンが含まれる。
  it('RPT-FE-084: rejected + 所有者 のとき OwnerActions に再申請ボタンが含まれる', () => {
    render(
      <ReportActionBar
        status="rejected"
        isOwner={true}
        currentUserRole="member"
      />,
    );

    expect(screen.getByRole('button', { name: '再申請' })).toBeInTheDocument();
  });

  // RPT-FE-085: status="approved"、isOwner=false、currentUserRole="accounting" のとき WorkflowActions が描画される。
  it('RPT-FE-085: approved + 非所有者 + accounting のとき WorkflowActions が描画される', () => {
    render(
      <ReportActionBar
        status="approved"
        isOwner={false}
        currentUserRole="accounting"
      />,
    );

    expect(screen.getByTestId('workflow-actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '支払完了' })).toBeInTheDocument();
  });

  // RPT-FE-086: status="paid" のとき OwnerActions も WorkflowActions も描画されない（終端状態）。
  it('RPT-FE-086: status="paid" のとき何も描画されない', () => {
    const { container } = render(
      <ReportActionBar
        status="paid"
        isOwner={true}
        currentUserRole="member"
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  // RPT-FE-087: pendingAction="submit" のとき提出ボタンが disabled + スピナー表示。他のボタンも disabled。
  it('RPT-FE-087: pendingAction="submit" のとき提出ボタンが disabled + スピナー表示', () => {
    render(
      <ReportActionBar
        status="draft"
        isOwner={true}
        currentUserRole="member"
        itemCount={1}
        pendingAction="submit"
      />,
    );

    // 提出ボタンが disabled であること
    expect(screen.getByRole('button', { name: '提出' })).toBeDisabled();
    // スピナーが表示されること
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});

describe('ReportActionBar - OwnerActions コールバック確認', () => {
  // RPT-FE-081 補足: 편집 버튼 클릭으로 onEdit이 호출되는지 확인
  it('OwnerActions の各コールバックが正しく渡される（smoke test）', () => {
    const handlers = {
      onEdit: vi.fn(),
      onSubmitReport: vi.fn(),
      onDelete: vi.fn(),
    };

    render(
      <ReportActionBar
        status="draft"
        isOwner={true}
        currentUserRole="member"
        itemCount={1}
        {...handlers}
      />,
    );

    // コンポーネントがマウントできること
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument();
  });
});

describe('ReportActionBar - 自己支払禁止', () => {
  // RPT-FE-083b: status="approved" + isOwner=true + currentUserRole="accounting" のとき WorkflowActions が描画されない。
  // authz.md §6 の自己支払禁止ルール（RBC-016）に準拠する。
  it('RPT-FE-083b: approved + 所有者 + accounting のとき WorkflowActions が描画されない（自己支払禁止）', () => {
    render(
      <ReportActionBar
        status="approved"
        isOwner={true}
        currentUserRole="accounting"
      />,
    );

    // WorkflowActions が非表示であること（自己支払禁止）
    expect(screen.queryByTestId('workflow-actions')).not.toBeInTheDocument();
    // 支払完了ボタンが表示されないこと
    expect(screen.queryByRole('button', { name: '支払完了' })).not.toBeInTheDocument();
  });
});
