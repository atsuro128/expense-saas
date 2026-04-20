// 対象期間の開始日・終了日を横並びに配置するコンポーネント。
// React Hook Form の Controller 経由で制御される。
// SCR-RPT-002, SCR-RPT-003 で使用する。

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import AppDatePicker from '../ui/AppDatePicker';
import type { ReportFormValues } from './ReportForm';

export interface ReportPeriodFieldProps {
  /** React Hook Form の control インスタンス */
  control: Control<ReportFormValues>;
  /** 開始日のエラーメッセージ */
  periodStartError?: string;
  /** 終了日のエラーメッセージ */
  periodEndError?: string;
  /** 無効化フラグ */
  disabled?: boolean;
}

/**
 * ReportPeriodField は対象期間の開始日・終了日を横並びに配置する。
 * 開始日と終了日の間に「〜」の区切りテキストを表示する。
 */
export default function ReportPeriodField({
  control,
  periodStartError,
  periodEndError,
  disabled = false,
}: ReportPeriodFieldProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      {/* 対象期間開始日 */}
      <Controller
        name="periodStart"
        control={control}
        render={({ field }) => (
          <AppDatePicker
            name="periodStart"
            label="開始日"
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            errorMessage={periodStartError}
            required
            disabled={disabled}
          />
        )}
      />

      {/* 区切りテキスト */}
      <Typography
        variant="body1"
        sx={{ mt: 1, flexShrink: 0, lineHeight: '40px' }}
      >
        〜
      </Typography>

      {/* 対象期間終了日 */}
      <Controller
        name="periodEnd"
        control={control}
        render={({ field }) => (
          <AppDatePicker
            name="periodEnd"
            label="終了日"
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            errorMessage={periodEndError}
            required
            disabled={disabled}
          />
        )}
      />
    </Box>
  );
}
