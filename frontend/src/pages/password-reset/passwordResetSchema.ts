// パスワードリセット実行フォームの Zod バリデーションスキーマ。

import { z } from 'zod';

/** パスワードリセット実行フォームの内部スキーマ（confirm_password を含む）。 */
export const passwordResetSchema = z
  .object({
    /** 新しいパスワード: 必須かつ 8 文字以上。API に送信する。 */
    new_password: z
      .string()
      .min(1, '新しいパスワードを入力してください')
      .min(8, 'パスワードは8文字以上で入力してください'),
    /** 確認用パスワード: 必須。API には送信しない。 */
    confirm_password: z.string().min(1, '確認用パスワードを入力してください'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'パスワードが一致しません',
    path: ['confirm_password'],
  });

/** passwordResetSchema から推論した型（confirm_password を含む内部型）。 */
export type PasswordResetSchemaInput = z.infer<typeof passwordResetSchema>;

/** API に送信するパスワードリセット入力値（confirm_password を除く）。 */
export interface PasswordResetInput {
  new_password: string;
}
