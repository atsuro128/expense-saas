// usePrevious カスタムフックのユニットテスト。
// issue #156 のちらつき防止に使用する usePrevious フックの基本動作を検証する。

import { renderHook } from '@testing-library/react';
import { usePrevious } from '../usePrevious';

describe('usePrevious', () => {
  it('初回レンダリング時は undefined を返す', () => {
    const { result } = renderHook(() => usePrevious('初期値'));

    // 初回レンダリング直後は前回値がないため undefined。
    expect(result.current).toBeUndefined();
  });

  it('値が更新されると直前の値を返す', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => usePrevious(value),
      { initialProps: { value: '最初の値' } },
    );

    // 初回: undefined
    expect(result.current).toBeUndefined();

    // 2 回目のレンダリング: 最初の値 → 新しい値
    rerender({ value: '新しい値' });

    // 前回の値（'最初の値'）が返る。
    expect(result.current).toBe('最初の値');
  });

  it('連続して値が変わっても常に直前の値を返す', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => usePrevious(value),
      { initialProps: { value: 'A' } },
    );

    rerender({ value: 'B' });
    expect(result.current).toBe('A');

    rerender({ value: 'C' });
    expect(result.current).toBe('B');

    rerender({ value: 'D' });
    expect(result.current).toBe('C');
  });

  it('数値型でも動作する', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => usePrevious(value),
      { initialProps: { value: 1 } },
    );

    expect(result.current).toBeUndefined();

    rerender({ value: 2 });
    expect(result.current).toBe(1);
  });

  it('boolean 型でも動作する', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: boolean }) => usePrevious(value),
      { initialProps: { value: true } },
    );

    expect(result.current).toBeUndefined();

    rerender({ value: false });
    expect(result.current).toBe(true);

    rerender({ value: true });
    expect(result.current).toBe(false);
  });

  it('同じ値で再レンダリングしても前回値を維持する', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => usePrevious(value),
      { initialProps: { value: 'A' } },
    );

    rerender({ value: 'B' });
    expect(result.current).toBe('A');

    // 同じ値 'B' で再レンダリング
    rerender({ value: 'B' });
    // 前回も 'B' だったので、前回値は 'B'
    expect(result.current).toBe('B');
  });
});
