// ログイン処理を行う React Query ミューテーション Hook。
// POST /api/auth/login を呼び出し、認証トークンを返す。
// 成功時に AuthStore にトークンを保存する（onSuccess コールバック）。

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, AuthTokens, AuthUser } from '../api/types';
import { setTokens } from '../stores/auth';

/** ログイン入力パラメータ。 */
export interface LoginParams {
  email: string;
  password: string;
}

/**
 * useLogin は POST /api/auth/login を呼び出すミューテーション Hook。
 * 未実装スタブ: API クライアントの動作確認用。
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LoginParams): Promise<AuthTokens> => {
      const res = await api.post<ApiResponse<AuthTokens>>('/api/auth/login', params);
      return res.data;
    },
    onSuccess: (data) => {
      // ログイン成功時にトークンを AuthStore に保存する。
      setTokens(data.access_token, data.refresh_token);
      // アカウント切り替え時に前ユーザーのキャッシュが残らないよう無効化する。
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      // ダッシュボード遷移時にキャッシュを温めてローディングスケルトンを回避する。
      void queryClient.prefetchQuery({
        queryKey: ['auth', 'me'],
        queryFn: () => api.get<ApiResponse<AuthUser>>('/api/auth/me'),
      });
    },
  });
}
