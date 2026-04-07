// レポートのタイトル・対象期間を入力するフォームコンポーネント。
// React Hook Form でバリデーションを行い、送信時に onSubmit コールバックを呼び出す。
// SCR-RPT-002（レポート作成）、SCR-RPT-003（レポート編集）で共有する。

import Box from '@mui/material/Box';
import { useForm, Controller } from 'react-hook-form';
import FormAlert from '../ui/FormAlert';
import AppTextField from '../ui/AppTextField';
import ReportPeriodField from './ReportPeriodField';
import ReportFormActions from './ReportFormActions';

export interface ReportFormValues {
  /** レポートタイトル */
  title: string;
  /** 対象期間開始日（YYYY-MM-DD 形式） */
  periodStart: string;
  /** 対象期間終了日（YYYY-MM-DD 形式） */
  periodEnd: string;
}

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
    formState: { errors },
    getValues,
  } = useForm<ReportFormValues>({
    defaultValues: defaultValues ?? DEFAULT_VALUES,
  });

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* API エラー表示 */}
      <FormAlert message={apiError} />

      {/* タイトル入力 */}
      <Controller
        name="title"
        control={control}
        rules={{
          required: 'タイトルは必須です',
          maxLength: { value: 200, message: 'タイトルは200文字以内で入力してください' },
        }}
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
      <ReportPeriodField
        control={control}
        periodStartError={errors.periodStart?.message}
        periodEndError={errors.periodEnd?.message}
        disabled={isPending}
        rules={{
          periodStart: {
            required: '開始日は必須です',
          },
          periodEnd: {
            required: '終了日は必須です',
            validate: (value: string) => {
              const start = getValues('periodStart');
              if (start && value && value < start) {
                return '開始日は終了日以前を指定してください';
              }
              return true;
            },
          },
        }}
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
