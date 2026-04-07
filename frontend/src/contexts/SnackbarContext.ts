// SnackbarContext: アプリ全体でスナックバー（トースト）通知を管理するコンテキスト。
// AppToast コンポーネントと連携して使用する。

import { createContext } from 'react';

/** SnackbarContext が提供するインターフェース。 */
export interface SnackbarContextValue {
  /** エラーメッセージをトーストで表示する。 */
  showError: (message: string) => void;
  /** 成功メッセージをトーストで表示する。 */
  showSuccess: (message: string) => void;
}

/** SnackbarContext は showError / showSuccess を提供するコンテキスト。 */
export const SnackbarContext = createContext<SnackbarContextValue | null>(null);
