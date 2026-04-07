// useSnackbar Hook: スナックバー（トースト）通知を制御するコンテキスト Hook。
// SnackbarContext を介してエラー・成功メッセージを表示する。

import { useContext } from 'react';
import { SnackbarContext } from '../contexts/SnackbarContext';

/**
 * useSnackbar は SnackbarContext を返すカスタム Hook。
 * showError, showSuccess などのメソッドを提供する。
 */
export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return ctx;
}
