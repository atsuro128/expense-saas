// パスワードリセット要求フォームの Zod バリデーションスキーマ。

import { z } from 'zod';

/** パスワードリセット要求フォームの入力スキーマ。 */
export const passwordResetRequestSchema = z.object({
  /** メールアドレス: 必須かつ email 形式、254 文字以内。 */
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .max(254, 'メールアドレスは254文字以内で入力してください')
    .email('有効なメールアドレスを入力してください'),
});

/** passwordResetRequestSchema から推論した型。 */
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
