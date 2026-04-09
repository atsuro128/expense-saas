// WorkflowActions コンポーネントのユニットテスト。
// WFL-FE-055〜068 に対応する。
// SCR-RPT-004（レポート詳細）の WorkflowActions コンポーネントの RBAC・UI 制御を検証する。
// スタブ実装段階では全テストが失敗する（赤い仕様テスト）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, afterEach, expect } from 'vitest';
import WorkflowActions from '../WorkflowActions';

describe('WorkflowActions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WFL-FE-055: status=submitted, currentUserRole=approver のとき「承認」「却下」ボタンが表示される。
  it('WFL-FE-055: shows_approve_reject_for_approver_submitted — Approver×submitted のとき承認・却下ボタンが表示される', () => {
    render(
      <WorkflowActions
        status="submitted"
        currentUserRole="approver"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // 「承認」ボタンが表示されること。スタブ実装では存在しないため失敗する。
    expect(screen.getByTestId('approve-button')).toBeInTheDocument();
    // 「却下」ボタンが表示されること。スタブ実装では存在しないため失敗する。
    expect(screen.getByTestId('reject-button')).toBeInTheDocument();
    // 「支払完了」ボタンが表示されないこと。
    expect(screen.queryByTestId('pay-button')).not.toBeInTheDocument();
  });

  // WFL-FE-056: status=approved, currentUserRole=accounting のとき「支払完了」ボタンが表示される。
  it('WFL-FE-056: shows_pay_for_accounting_approved — Accounting×approved のとき支払完了ボタンが表示される', () => {
    render(
      <WorkflowActions
        status="approved"
        currentUserRole="accounting"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // 「支払完了」ボタンが表示されること。スタブ実装では存在しないため失敗する。
    expect(screen.getByTestId('pay-button')).toBeInTheDocument();
    // 「承認」「却下」ボタンが表示されないこと。
    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
  });

  // WFL-FE-057: status=submitted, currentUserRole=member のとき全ボタンが表示されない（認可制御）。
  it('WFL-FE-057: hides_approve_reject_for_non_approver — Member には承認・却下・支払完了ボタンが表示されない', () => {
    render(
      <WorkflowActions
        status="submitted"
        currentUserRole="member"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // どのボタンも表示されないこと。スタブ実装では null を返すため通過する。
    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pay-button')).not.toBeInTheDocument();
  });

  // WFL-FE-058: status=approved, currentUserRole=approver のとき「支払完了」ボタンが表示されない（認可制御）。
  it('WFL-FE-058: hides_pay_for_non_accounting — Approver には支払完了ボタンが表示されない', () => {
    render(
      <WorkflowActions
        status="approved"
        currentUserRole="approver"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // 「支払完了」ボタンが表示されないこと。スタブ実装では null を返すため通過する。
    expect(screen.queryByTestId('pay-button')).not.toBeInTheDocument();
  });

  // WFL-FE-059: status=draft, currentUserRole=approver のとき全ボタンが表示されない。
  it('WFL-FE-059: hides_all_for_approver_non_submitted — Approver×draft のとき全ボタンが表示されない', () => {
    render(
      <WorkflowActions
        status="draft"
        currentUserRole="approver"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // どのボタンも表示されないこと（提出済みでないため）。スタブ実装では null を返すため通過する。
    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pay-button')).not.toBeInTheDocument();
  });

  // WFL-FE-060: status=approved, currentUserRole=approver のとき全ボタンが表示されない。
  it('WFL-FE-060: hides_all_for_approver_approved — Approver×approved のとき全ボタンが表示されない', () => {
    render(
      <WorkflowActions
        status="approved"
        currentUserRole="approver"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // どのボタンも表示されないこと。スタブ実装では null を返すため通過する。
    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pay-button')).not.toBeInTheDocument();
  });

  // WFL-FE-061: status=submitted, currentUserRole=accounting のとき全ボタンが表示されない。
  it('WFL-FE-061: hides_all_for_accounting_non_approved — Accounting×submitted のとき全ボタンが表示されない', () => {
    render(
      <WorkflowActions
        status="submitted"
        currentUserRole="accounting"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // どのボタンも表示されないこと（承認済みでないため）。スタブ実装では null を返すため通過する。
    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pay-button')).not.toBeInTheDocument();
  });

  // WFL-FE-062: status=paid, currentUserRole=accounting のとき全ボタンが表示されない。
  it('WFL-FE-062: hides_all_for_accounting_paid — Accounting×paid のとき全ボタンが表示されない', () => {
    render(
      <WorkflowActions
        status="paid"
        currentUserRole="accounting"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // どのボタンも表示されないこと（支払済みのため）。スタブ実装では null を返すため通過する。
    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pay-button')).not.toBeInTheDocument();
  });

  // WFL-FE-063: Approver×submitted で「承認」ボタンをクリックすると onApprove が呼ばれる。
  it('WFL-FE-063: calls_on_approve_on_click — 「承認」ボタンクリックで onApprove が呼ばれる', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();

    render(
      <WorkflowActions
        status="submitted"
        currentUserRole="approver"
        isOwner={false}
        onApprove={onApprove}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // 「承認」ボタンをクリックする。スタブ実装では存在しないため失敗する。
    await user.click(screen.getByTestId('approve-button'));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  // WFL-FE-064: Approver×submitted で「却下」ボタンをクリックすると onReject が呼ばれる。
  it('WFL-FE-064: calls_on_reject_on_click — 「却下」ボタンクリックで onReject が呼ばれる', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();

    render(
      <WorkflowActions
        status="submitted"
        currentUserRole="approver"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={onReject}
        onMarkAsPaid={vi.fn()}
        pendingAction={null}
      />,
    );

    // 「却下」ボタンをクリックする。スタブ実装では存在しないため失敗する。
    await user.click(screen.getByTestId('reject-button'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  // WFL-FE-065: Accounting×approved で「支払完了」ボタンをクリックすると onMarkAsPaid が呼ばれる。
  it('WFL-FE-065: calls_on_mark_as_paid_on_click — 「支払完了」ボタンクリックで onMarkAsPaid が呼ばれる', async () => {
    const user = userEvent.setup();
    const onMarkAsPaid = vi.fn();

    render(
      <WorkflowActions
        status="approved"
        currentUserRole="accounting"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={onMarkAsPaid}
        pendingAction={null}
      />,
    );

    // 「支払完了」ボタンをクリックする。スタブ実装では存在しないため失敗する。
    await user.click(screen.getByTestId('pay-button'));
    expect(onMarkAsPaid).toHaveBeenCalledTimes(1);
  });

  // WFL-FE-066: pendingAction=approve のとき「承認」ボタンが disabled かつスピナー表示。「却下」ボタンも disabled。
  it('WFL-FE-066: disables_buttons_during_approve — pendingAction=approve のとき承認・却下ボタンが disabled', () => {
    render(
      <WorkflowActions
        status="submitted"
        currentUserRole="approver"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction="approve"
      />,
    );

    // 「承認」ボタンが disabled かつスピナー表示であること。スタブ実装では存在しないため失敗する。
    const approveButton = screen.getByTestId('approve-button');
    expect(approveButton).toBeDisabled();
    expect(screen.getByTestId('approve-spinner')).toBeInTheDocument();
    // 「却下」ボタンも disabled であること。
    expect(screen.getByTestId('reject-button')).toBeDisabled();
  });

  // WFL-FE-067: pendingAction=reject のとき「却下」ボタンが disabled かつスピナー表示。「承認」ボタンも disabled。
  it('WFL-FE-067: disables_buttons_during_reject — pendingAction=reject のとき承認・却下ボタンが disabled', () => {
    render(
      <WorkflowActions
        status="submitted"
        currentUserRole="approver"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction="reject"
      />,
    );

    // 「却下」ボタンが disabled かつスピナー表示であること。スタブ実装では存在しないため失敗する。
    const rejectButton = screen.getByTestId('reject-button');
    expect(rejectButton).toBeDisabled();
    expect(screen.getByTestId('reject-spinner')).toBeInTheDocument();
    // 「承認」ボタンも disabled であること。
    expect(screen.getByTestId('approve-button')).toBeDisabled();
  });

  // WFL-FE-068: pendingAction=pay のとき「支払完了」ボタンが disabled かつスピナー表示。
  it('WFL-FE-068: disables_button_during_pay — pendingAction=pay のとき支払完了ボタンが disabled', () => {
    render(
      <WorkflowActions
        status="approved"
        currentUserRole="accounting"
        isOwner={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onMarkAsPaid={vi.fn()}
        pendingAction="pay"
      />,
    );

    // 「支払完了」ボタンが disabled かつスピナー表示であること。スタブ実装では存在しないため失敗する。
    const payButton = screen.getByTestId('pay-button');
    expect(payButton).toBeDisabled();
    expect(screen.getByTestId('pay-spinner')).toBeInTheDocument();
  });
});
