// パスワードリセット要求を行う React Query ミューテーション Hook。
// POST /api/auth/password-reset を呼び出す。
// SEC-011: ユーザーの存在に関わらず同一のレスポンスを返す。

import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse } from '../api/types';

/** パスワードリセット要求レスポンスデータ。 */
export interface PasswordResetRequestResponse {
  message: string;
}

/** パスワードリセット要求入力パラメータ。 */
export interface RequestPasswordResetParams {
  email: string;
}

/**
 * useRequestPasswordReset は POST /api/auth/password-reset を呼び出すミューテーション Hook。
 * 未実装スタブ: API クライアントの動作確認用。
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (params: RequestPasswordResetParams): Promise<PasswordResetRequestResponse> => {
      const res = await api.post<ApiResponse<PasswordResetRequestResponse>>('/api/auth/password-reset', params);
      return res.data;
    },
  });
}
