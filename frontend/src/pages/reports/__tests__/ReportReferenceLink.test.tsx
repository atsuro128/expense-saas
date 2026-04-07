// ReportReferenceLink コンポーネントのユニットテスト。
// RPT-FE-079〜080 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportReferenceLink from '../ReportReferenceLink';

describe('ReportReferenceLink', () => {
  // RPT-FE-079: referenceReportId と referenceReportTitle があるとき、リンクが描画される。
  it('RPT-FE-079: referenceReportId と referenceReportTitle があるとき /reports/:id へのリンクが描画される', () => {
    render(
      <MemoryRouter>
        <ReportReferenceLink
          referenceReportId="ref-report-id"
          referenceReportTitle="元レポート"
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: '元レポート' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/reports/ref-report-id');
  });

  // RPT-FE-080: referenceReportId=null のときコンポーネントが描画されない。
  it('RPT-FE-080: referenceReportId=null のときコンポーネントが描画されない', () => {
    const { container } = render(
      <MemoryRouter>
        <ReportReferenceLink referenceReportId={null} referenceReportTitle={null} />
      </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
  });
});
