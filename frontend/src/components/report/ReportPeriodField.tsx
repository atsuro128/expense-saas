// 対象期間の開始日・終了日を配置するコンポーネント。
// スマホ幅（xs）では縦積み、sm 以上では横並びで表示する。
// React Hook Form の Controller 経由で制御される。
// SCR-RPT-002, SCR-RPT-003 で使用する。

import Stack from '@mui/material/Stack';
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
 * ReportPeriodField は対象期間の開始日・終了日を配置する。
 * スマホ幅（xs）では縦積みで全幅表示、sm 以上では横並び + 区切りテキスト表示。
 * ui-guidelines.md § レスポンシブ対応（Stack 使用方針）に準拠。
 */
export default function ReportPeriodField({
  control,
  periodStartError,
  periodEndError,
  disabled = false,
}: ReportPeriodFieldProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      spacing={{ xs: 1, sm: 1 }}
    >
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

      {/* 区切りテキスト: sm 以上のみ表示、スマホ幅（xs）では非表示 */}
      <Typography
        variant="body1"
        sx={{ mt: 1, flexShrink: 0, lineHeight: '40px', display: { xs: 'none', sm: 'block' } }}
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
    </Stack>
  );
}
