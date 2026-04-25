// 対象期間の開始日・終了日を配置するコンポーネント。
// スマホ幅（xs）では縦積み、sm 以上では横並びで表示する。
// React Hook Form の Controller 経由で制御される。
// SCR-RPT-002, SCR-RPT-003 で使用する。

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Controller } from 'react-hook-form';
import type { Control, UseFormGetValues, UseFormTrigger } from 'react-hook-form';
import AppDatePicker from '../ui/AppDatePicker';
import type { ReportFormValues } from './ReportForm';

export interface ReportPeriodFieldProps {
  /** React Hook Form の control インスタンス */
  control: Control<ReportFormValues>;
  /**
   * RHF の trigger 関数。
   * 両フィールドが入力済みの時のみ V5-S / V5-E の相互再評価に使用する（issue #141）。
   */
  trigger: UseFormTrigger<ReportFormValues>;
  /**
   * RHF の getValues 関数。
   * trigger 呼び出し前に「両フィールド入力済み」を判定し、未入力側に V3/V4 の必須エラーが
   * 先出しされないようガードするために使用する（issue #141 / PR #95 codex 指摘対応）。
   */
  getValues: UseFormGetValues<ReportFormValues>;
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
 *
 * どちらのフィールドでフォーカスアウトしても、両フィールドが入力済みの場合のみ
 * trigger(['periodStart', 'periodEnd']) を呼び、V5-S（開始日直下）と V5-E（終了日直下）の
 * 両方を再評価する（issue #141）。
 *
 * 片方のみ入力した状態での blur では当該フィールドの通常バリデーション（V3 or V4 + V5-S or V5-E）
 * のみが走るため、未操作の相手側に V3/V4 の必須エラーが先出しされない（PR #95 codex 指摘対応）。
 */
export default function ReportPeriodField({
  control,
  trigger,
  getValues,
  periodStartError,
  periodEndError,
  disabled = false,
}: ReportPeriodFieldProps) {
  /**
   * 対象期間フィールドの共通 onBlur ハンドラ。
   * 当該フィールドの field.onBlur で通常バリデーションを実行する。
   * 加えて、両フィールドが入力済みの場合のみ trigger を呼んで V5 を相互再評価する。
   * 片方のみ入力済みの場合は trigger を呼ばないため、未操作側の必須エラー（V3/V4）は
   * フォーカスアウトされるまで表示されない（設計書 §4 V3/V4「フォーカスアウト時」と整合）。
   */
  const handlePeriodBlur = (fieldOnBlur: () => void) => {
    fieldOnBlur();
    const { periodStart, periodEnd } = getValues();
    if (periodStart && periodEnd) {
      void trigger(['periodStart', 'periodEnd']);
    }
  };

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      spacing={1}
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
            onBlur={() => handlePeriodBlur(field.onBlur)}
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
            onBlur={() => handlePeriodBlur(field.onBlur)}
            errorMessage={periodEndError}
            required
            disabled={disabled}
          />
        )}
      />
    </Stack>
  );
}
