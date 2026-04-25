// レポートのタイトル・対象期間を入力するフォームコンポーネント。
// React Hook Form + Zod でクライアントサイドバリデーションを行い、送信時に onSubmit コールバックを呼び出す。
// SCR-RPT-002（レポート作成）、SCR-RPT-003（レポート編集）で共有する。

import { useEffect } from 'react';
import Box from '@mui/material/Box';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import FormAlert from '../ui/FormAlert';
import AppTextField from '../ui/AppTextField';
import ReportPeriodField from './ReportPeriodField';
import ReportFormActions from './ReportFormActions';

/**
 * レポートフォームの Zod バリデーションスキーマ。
 * report-create.md / report-edit.md の V1〜V5 に準拠。
 * V5-S / V5-E は同一業務ルール（RPT-003）を 2 経路から検証する（issue #141）。
 */
export const reportFormSchema = z
  .object({
    // V1: タイトル必須
    title: z
      .string()
      .min(1, 'タイトルを入力してください')
      // V2: 200文字以内
      .max(200, 'タイトルは200文字以内で入力してください'),
    // V3: 開始日（サーバー側バリデーションを信頼境界とし、フロント側は補助）
    periodStart: z.string().min(1, '開始日を入力してください'),
    // V4: 終了日（サーバー側バリデーションを信頼境界とし、フロント側は補助）
    periodEnd: z.string().min(1, '終了日を入力してください'),
  })
  // V5-S: 開始日 <= 終了日（開始日フィールド直下にフィールド主語の文言を表示）
  .refine((data) => !data.periodStart || !data.periodEnd || data.periodStart <= data.periodEnd, {
    message: '開始日は終了日以前を指定してください',
    path: ['periodStart'],
  })
  // V5-E: 開始日 <= 終了日（終了日フィールド直下にフィールド主語の文言を表示）
  .refine((data) => !data.periodStart || !data.periodEnd || data.periodStart <= data.periodEnd, {
    message: '終了日は開始日以降を指定してください',
    path: ['periodEnd'],
  });

export type ReportFormValues = z.infer<typeof reportFormSchema>;

export interface ReportFormProps {
  /** フォーム送信時のコールバック */
  onSubmit: (data: ReportFormValues) => void;
  /** キャンセルボタン押下時のコールバック */
  onCancel: () => void;
  /** API エラーメッセージ（フォーム上部に Alert 表示） */
  apiError: string | null;
  /** 送信中フラグ（ボタン・入力フィールドの disabled 制御） */
  isPending: boolean;
  /** 送信ボタンのラベルテキスト */
  submitLabel: string;
  /** フォームの初期値（編集時・再申請時にプリフィル） */
  defaultValues?: ReportFormValues;
}

const DEFAULT_VALUES: ReportFormValues = {
  title: '',
  periodStart: '',
  periodEnd: '',
};

/**
 * ReportForm はレポート作成・編集で共有するフォームコンポーネント。
 * タイトル入力、対象期間入力（ReportPeriodField）、アクションボタン（ReportFormActions）を統合する。
 * API エラーはフォーム上部の FormAlert に表示する。
 */
export default function ReportForm({
  onSubmit,
  onCancel,
  apiError,
  isPending,
  submitLabel,
  defaultValues,
}: ReportFormProps) {
  const {
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { errors },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: defaultValues ?? DEFAULT_VALUES,
    // V1/V3/V4: フォーカスアウト時にバリデーション、V2: 入力時（リアルタイム）
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  /**
   * defaultValues が変更されたとき（?ref でプリフィルされるとき等）フォームをリセットする。
   * useForm の defaultValues はマウント時のみ反映されるため、非同期で取得された値を反映させるには reset が必要。
   */
  useEffect(() => {
    if (defaultValues) {
      reset(defaultValues);
    }
  }, [defaultValues, reset]);

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* API エラー表示 */}
      <FormAlert message={apiError} />

      {/* タイトル入力 */}
      <Controller
        name="title"
        control={control}
        render={({ field }) => (
          <AppTextField
            {...field}
            label="タイトル"
            errorMessage={errors.title?.message}
            required
            disabled={isPending}
            sx={{ mb: 2 }}
          />
        )}
      />

      {/* 対象期間入力 */}
      {/* trigger を渡し、どちらのフィールドの onBlur でも両方の V5 バリデーションを再評価する（issue #141）*/}
      <ReportPeriodField
        control={control}
        trigger={trigger}
        periodStartError={errors.periodStart?.message}
        periodEndError={errors.periodEnd?.message}
        disabled={isPending}
      />

      {/* アクションボタン */}
      <ReportFormActions
        submitLabel={submitLabel}
        loading={isPending}
        onCancel={onCancel}
      />
    </Box>
  );
}
