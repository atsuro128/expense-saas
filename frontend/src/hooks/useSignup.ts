// サインアップ処理を行う React Query ミューテーション Hook。
// POST /api/auth/signup を呼び出し、認証トークンを返す。
// 成功時に AuthStore にトークンを保存する（onSuccess コールバック）。

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, AuthTokens, AuthUser } from '../api/types';
import { setTokens } from '../stores/auth';

/** サインアップ入力パラメータ。 */
export interface SignupParams {
  company_name: string;
  user_name: string;
  email: string;
  password: string;
}

/**
 * useSignup は POST /api/auth/signup を呼び出すミューテーション Hook。
 * 未実装スタブ: API クライアントの動作確認用。
 */
export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SignupParams): Promise<AuthTokens> => {
      const res = await api.post<ApiResponse<AuthTokens>>('/api/auth/signup', params);
      return res.data;
    },
    onSuccess: (data) => {
      // サインアップ成功時にトークンを AuthStore に保存する。
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
