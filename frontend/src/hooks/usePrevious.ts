// 直前のレンダリング時の値を保持するカスタムフック。
// React 公式推奨パターン（useEffect + useRef）で実装する。
// StrictMode の二重実行（開発時）にも耐性がある。
//
// 主な用途: ConfirmDialog で open=false 時に前回の title/message を保持し、
// 閉じるアニメーション中のちらつきを防ぐ（issue #156）。

import { useEffect, useRef } from 'react';

/**
 * usePrevious は直前のレンダリング時の値を返す。
 *
 * - 初回レンダリング時は undefined を返す。
 * - 更新後のレンダリングでは、その前のレンダリング時の値を返す。
 *
 * @param value - 追跡する値
 * @returns 直前のレンダリング時の値（初回は undefined）
 */
export function usePrevious<T>(value: T): T | undefined {
  // ref に前回の値を保存する。ref への代入は副作用として useEffect で行う。
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    // このエフェクトは render 後に実行されるため、
    // 呼び出し元が現在の value を受け取った後に ref が更新される。
    ref.current = value;
  }, [value]);

  // 現在のレンダリング時点では、まだ useEffect が実行されていないため
  // ref.current には「直前の値」が入っている。
  return ref.current;
}
