// formatFileSize 関数のユニットテスト。
// 境界値を網羅的にカバーする。

import { describe, it, expect } from 'vitest';
import { formatFileSize } from '../format';

describe('formatFileSize', () => {
  // 境界値: 0 バイト
  it('0 バイトは "0 B" を返す', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  // 境界値: 1023 バイト（1KB 未満の上限）
  it('1023 バイトは "1023 B" を返す', () => {
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  // 境界値: 1024 バイト（1KB ちょうど）
  it('1024 バイトは "1 KB" を返す', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
  });

  // 1MB 未満の代表値: 240KB
  it('245760 バイト（240KB）は "240 KB" を返す', () => {
    expect(formatFileSize(245760)).toBe('240 KB');
  });

  // 境界値: 1048575 バイト（1MB - 1byte）
  it('1048575 バイトは "1024 KB" を返す', () => {
    expect(formatFileSize(1048575)).toBe('1024 KB');
  });

  // 境界値: 1048576 バイト（1MB ちょうど）
  it('1048576 バイトは "1.0 MB" を返す', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  // 代表値: 2.7MB
  it('2859424 バイトは "2.7 MB" を返す', () => {
    expect(formatFileSize(2859424)).toBe('2.7 MB');
  });

  // 代表値: 4.6MB
  it('4808655 バイトは "4.6 MB" を返す', () => {
    expect(formatFileSize(4808655)).toBe('4.6 MB');
  });
});
