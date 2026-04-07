// 再申請元レポートリンクコンポーネント（スタブ）。
// SCR-RPT-004 に対応する。

import { Link } from 'react-router-dom';

export interface ReportReferenceLinkProps {
  referenceReportId: string | null;
  referenceReportTitle: string | null;
}

/**
 * ReportReferenceLink は再申請元レポートへのリンクを表示する。
 * referenceReportId が null の場合は何も描画しない。
 */
export default function ReportReferenceLink({
  referenceReportId,
  referenceReportTitle,
}: ReportReferenceLinkProps) {
  if (!referenceReportId) {
    return null;
  }

  return (
    <Link to={`/reports/${referenceReportId}`}>{referenceReportTitle}</Link>
  );
}
