// サインアップフォームの Zod バリデーションスキーマ。

import { z } from 'zod';

/** サインアップフォームの入力スキーマ。 */
export const signupSchema = z.object({
  /** 会社名: 必須かつ 1〜200 文字。 */
  company_name: z
    .string()
    .min(1, '会社名は必須です')
    .max(200, '会社名は200文字以内で入力してください'),
  /** ユーザー名: 必須かつ 1〜100 文字。 */
  user_name: z
    .string()
    .min(1, 'ユーザー名は必須です')
    .max(100, 'ユーザー名は100文字以内で入力してください'),
  /** メールアドレス: 必須かつ email 形式。 */
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('メールアドレスの形式が正しくありません'),
  /** パスワード: 必須かつ 8〜128 文字。 */
  password: z
    .string()
    .min(1, 'パスワードは必須です')
    .min(8, 'パスワードは8文字以上で入力してください')
    .max(128, 'パスワードは128文字以内で入力してください'),
});

/** signupSchema から推論した型。 */
export type SignupInput = z.infer<typeof signupSchema>;
