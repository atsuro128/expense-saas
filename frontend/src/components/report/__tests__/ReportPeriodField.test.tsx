// ReportPeriodField コンポーネントのユニットテスト。
// RPT-FE-039〜042 に対応する。

import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ReportPeriodField from '../ReportPeriodField';
import { reportFormSchema, type ReportFormValues } from '../ReportForm';

// ReportPeriodField は React Hook Form の control を必要とするため、
// ラッパーコンポーネントを用意する。
interface WrapperProps {
  periodStartError?: string;
  periodEndError?: string;
  disabled?: boolean;
}

function Wrapper({ periodStartError, periodEndError, disabled }: WrapperProps) {
  const { control } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { title: '', periodStart: '', periodEnd: '' },
  });
  return (
    <ReportPeriodField
      control={control}
      periodStartError={periodStartError}
      periodEndError={periodEndError}
      disabled={disabled}
    />
  );
}

describe('ReportPeriodField', () => {
  // RPT-FE-039: 開始日・終了日の AppDatePicker と「〜」区切りテキストが描画される。
  it('RPT-FE-039: 開始日・終了日の AppDatePicker と「〜」区切りテキストが描画される', () => {
    render(<Wrapper />);

    expect(screen.getByLabelText('開始日')).toBeInTheDocument();
    expect(screen.getByLabelText('終了日')).toBeInTheDocument();
    expect(screen.getByText('〜')).toBeInTheDocument();
  });

  // RPT-FE-040: periodStartError を渡すと開始日の AppDatePicker にエラーメッセージが表示される。
  it('RPT-FE-040: periodStartError があると開始日にエラーメッセージが表示される', () => {
    render(<Wrapper periodStartError="開始日は必須です" />);

    expect(screen.getByText('開始日は必須です')).toBeInTheDocument();
  });

  // RPT-FE-041: periodEndError を渡すと終了日の AppDatePicker にエラーメッセージが表示される。
  it('RPT-FE-041: periodEndError があると終了日にエラーメッセージが表示される', () => {
    render(<Wrapper periodEndError="終了日は開始日以降にしてください" />);

    expect(screen.getByText('終了日は開始日以降にしてください')).toBeInTheDocument();
  });

  // RPT-FE-042: disabled=true のとき両方の AppDatePicker が disabled になる。
  it('RPT-FE-042: disabled=true のとき両方の AppDatePicker が disabled になる', () => {
    render(<Wrapper disabled={true} />);

    expect(screen.getByLabelText('開始日')).toBeDisabled();
    expect(screen.getByLabelText('終了日')).toBeDisabled();
  });
});
