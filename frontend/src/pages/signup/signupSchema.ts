// サインアップフォームの Zod バリデーションスキーマ。

import { z } from 'zod';

/** サインアップフォームの入力スキーマ。 */
export const signupSchema = z.object({
  /** 会社名: 必須かつ 1〜200 文字。 */
  company_name: z
    .string()
    .min(1, '会社名を入力してください')
    .max(200, '会社名は200文字以内で入力してください'),
  /** ユーザー名: 必須かつ 1〜100 文字。 */
  user_name: z
    .string()
    .min(1, 'ユーザー名を入力してください')
    .max(100, 'ユーザー名は100文字以内で入力してください'),
  /** メールアドレス: 必須かつ email 形式、254 文字以内。 */
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .max(254, 'メールアドレスは254文字以内で入力してください')
    .email('有効なメールアドレスを入力してください'),
  /** パスワード: 必須かつ 8〜128 文字。 */
  password: z
    .string()
    .min(1, 'パスワードを入力してください')
    .min(8, 'パスワードは8文字以上で入力してください')
    .max(128, 'パスワードは128文字以内で入力してください'),
});

/** signupSchema から推論した型。 */
export type SignupInput = z.infer<typeof signupSchema>;
