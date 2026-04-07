// TenantInfoField のユニットテスト。
// TNT-FE-011 に対応する。

import { render, screen } from '@testing-library/react';
import { describe, it } from 'vitest';
import TenantInfoField from '../TenantInfoField';

describe('TenantInfoField', () => {
  // TNT-FE-011: label と value が渡された場合、それぞれが描画されること。
  it('TNT-FE-011: label="会社名" value="Test Company A" を渡すとラベルと値が描画される', () => {
    render(<TenantInfoField label="会社名" value="Test Company A" />);

    expect(screen.getByText('会社名')).toBeInTheDocument();
    expect(screen.getByText('Test Company A')).toBeInTheDocument();
  });
});
