// ログインフォームの Zod バリデーションスキーマ。

import { z } from 'zod';

/** ログインフォームの入力スキーマ。 */
export const loginSchema = z.object({
  /** メールアドレス: 必須かつ email 形式。 */
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('有効なメールアドレスを入力してください'),
  /** パスワード: 必須かつ 8 文字以上。 */
  password: z
    .string()
    .min(1, 'パスワードを入力してください')
    .min(8, 'パスワードは8文字以上で入力してください'),
});

/** loginSchema から推論した型。 */
export type LoginInput = z.infer<typeof loginSchema>;
