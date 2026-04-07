// ReportWorkflowInfo コンポーネントのユニットテスト。
// RPT-FE-073〜078 に対応する。

import { render, screen } from '@testing-library/react';
import ReportWorkflowInfo from '../ReportWorkflowInfo';

describe('ReportWorkflowInfo', () => {
  // RPT-FE-073: status="draft" のときワークフロー関連項目が非表示。
  it('RPT-FE-073: status="draft" のときワークフロー関連項目が非表示', () => {
    const { container } = render(<ReportWorkflowInfo status="draft" />);
    // null を返すため container は空
    expect(container.firstChild).toBeNull();
  });

  // RPT-FE-074: status="submitted"、submittedAt があるとき提出日が表示される。
  it('RPT-FE-074: status="submitted" のとき提出日が表示される', () => {
    render(
      <ReportWorkflowInfo
        status="submitted"
        submittedAt="2026-03-15T10:00:00Z"
      />,
    );

    expect(screen.getByTestId('submitted-at')).toBeInTheDocument();
    expect(screen.getByText(/2026-03-15/)).toBeInTheDocument();
  });

  // RPT-FE-075: status="approved" のとき承認者名・承認日・承認コメントが表示される。
  it('RPT-FE-075: status="approved" のとき承認情報が表示される', () => {
    render(
      <ReportWorkflowInfo
        status="approved"
        approverName="承認者太郎"
        approvedAt="2026-03-16T10:00:00Z"
        approvalComment="問題ありません"
      />,
    );

    expect(screen.getByText('承認者太郎')).toBeInTheDocument();
    expect(screen.getByText(/2026-03-16/)).toBeInTheDocument();
    expect(screen.getByText('問題ありません')).toBeInTheDocument();
  });

  // RPT-FE-076: status="rejected" のとき却下者名・却下日・却下理由が表示される。
  it('RPT-FE-076: status="rejected" のとき却下情報が表示される', () => {
    render(
      <ReportWorkflowInfo
        status="rejected"
        rejectorName="承認者次郎"
        rejectedAt="2026-03-16T10:00:00Z"
        rejectionReason="領収書が不足しています"
      />,
    );

    expect(screen.getByText('承認者次郎')).toBeInTheDocument();
    expect(screen.getByText(/2026-03-16/)).toBeInTheDocument();
    expect(screen.getByTestId('rejection-reason')).toBeInTheDocument();
    expect(screen.getByText('領収書が不足しています')).toBeInTheDocument();
  });

  // RPT-FE-077: status="paid" のとき支払処理者名と支払完了日が表示される。
  it('RPT-FE-077: status="paid" のとき支払情報が表示される', () => {
    render(
      <ReportWorkflowInfo
        status="paid"
        paidByName="経理花子"
        paidAt="2026-03-20T10:00:00Z"
      />,
    );

    expect(screen.getByText('経理花子')).toBeInTheDocument();
    expect(screen.getByText(/2026-03-20/)).toBeInTheDocument();
  });

  // RPT-FE-078: status="approved"、approvalComment=null のとき承認コメント欄が非表示。
  it('RPT-FE-078: approvalComment=null のとき承認コメント欄が非表示', () => {
    render(
      <ReportWorkflowInfo
        status="approved"
        approverName="承認者"
        approvedAt="2026-03-16T10:00:00Z"
        approvalComment={null}
      />,
    );

    expect(screen.queryByTestId('approval-comment')).not.toBeInTheDocument();
  });
});
