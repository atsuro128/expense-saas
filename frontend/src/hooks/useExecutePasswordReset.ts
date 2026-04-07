// パスワードリセット実行を行う React Query ミューテーション Hook。
// PUT /api/auth/password-reset/:token を呼び出す。
// トークンは 1 回使用で無効化される（SEC-006）。

import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse } from '../api/types';

/** パスワードリセット実行レスポンスデータ。 */
export interface PasswordResetResponse {
  message: string;
}

/** パスワードリセット実行入力パラメータ。 */
export interface ExecutePasswordResetParams {
  /** URL パラメータから取得したリセットトークン。 */
  token: string;
  /** 新しいパスワード。 */
  new_password: string;
}

/**
 * useExecutePasswordReset は PUT /api/auth/password-reset/:token を呼び出すミューテーション Hook。
 * 未実装スタブ: API クライアントの動作確認用。
 */
export function useExecutePasswordReset() {
  return useMutation({
    mutationFn: async (params: ExecutePasswordResetParams): Promise<PasswordResetResponse> => {
      const res = await api.put<ApiResponse<PasswordResetResponse>>(
        `/api/auth/password-reset/${params.token}`,
        { new_password: params.new_password },
      );
      return res.data;
    },
  });
}
