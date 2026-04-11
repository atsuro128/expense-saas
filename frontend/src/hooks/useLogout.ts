// ログアウト処理を行う React Query ミューテーション Hook。
// POST /api/auth/logout を呼び出し、サーバー側のリフレッシュトークンを失効させる。
// 成功・失敗にかかわらずローカルトークンとクエリキャッシュを破棄する。

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { clearTokens, getRefreshToken } from '../stores/auth';

/**
 * useLogout は POST /api/auth/logout を呼び出すミューテーション Hook。
 * state-management.md の useLogout 設計に準拠。
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api.post('/api/auth/logout', { refresh_token: refreshToken });
      }
    },
    onSettled: () => {
      // 成功・失敗にかかわらずローカル状態を破棄する。
      clearTokens();
      queryClient.clear();
    },
  });
}
