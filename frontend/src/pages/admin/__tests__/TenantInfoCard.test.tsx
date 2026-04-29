// TenantInfoCard のユニットテスト。
// TNT-FE-008〜010 に対応する。

import { render, screen } from '@testing-library/react';
import { describe, it } from 'vitest';
import TenantInfoCard from '../TenantInfoCard';
import { ApiClientError } from '../../../api/client';

describe('TenantInfoCard', () => {
  // TNT-FE-008: tenant が渡された場合、TenantInfoField がラベル「会社名」・値「Test Company A」で描画されること。
  it('TNT-FE-008: tenant が渡されたとき会社名が表示される', () => {
    const tenant = {
      id: 'aaaaaaaa-0001-0001-0001-000000000001',
      name: 'Test Company A',
      created_at: '2026-01-01T00:00:00Z',
    };

    render(<TenantInfoCard tenant={tenant} loading={false} error={null} />);

    // TenantInfoField がラベル「会社名」、値「Test Company A」で描画されること。
    expect(screen.getByText('会社名')).toBeInTheDocument();
    expect(screen.getByText('Test Company A')).toBeInTheDocument();
  });

  // TNT-FE-009: loading = true の場合、PageSkeleton（variant="card"）が描画されること。
  it('TNT-FE-009: loading = true のとき PageSkeleton が描画される', () => {
    render(<TenantInfoCard tenant={undefined} loading={true} error={null} />);

    // PageSkeleton（variant="card"）が描画されること。
    // PageSkeleton は data-testid="page-skeleton" / data-variant="card" を付与する。
    const skeleton = screen.getByTestId('page-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('data-variant', 'card');

    // TenantInfoField が描画されないこと。
    expect(screen.queryByText('会社名')).not.toBeInTheDocument();
  });

  // TNT-FE-010: 404 エラーの場合、「テナント情報が見つかりません。」が表示されること。
  it('TNT-FE-010: 404 エラーのとき「テナント情報が見つかりません。」が表示される', () => {
    const error = new ApiClientError('Not Found', 404, 'NOT_FOUND');

    render(<TenantInfoCard tenant={undefined} loading={false} error={error} />);

    expect(screen.getByText('テナント情報が見つかりません。')).toBeInTheDocument();
  });
});
