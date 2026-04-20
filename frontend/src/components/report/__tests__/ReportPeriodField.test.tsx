// ReportPeriodField コンポーネントのユニットテスト。
// RPT-FE-039〜042、RPT-FE-043〜044 に対応する。
// RPT-FE-043〜044: issue 119（onBlur 伝播）修正確認テスト。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  /** onBlur 発火時の RHF バリデーション動作を確認するためにエラー表示を有効化する */
  withFormErrors?: boolean;
}

function Wrapper({ periodStartError, periodEndError, disabled, withFormErrors }: WrapperProps) {
  const { control, formState: { errors } } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { title: '', periodStart: '', periodEnd: '' },
    mode: 'onBlur',
  });
  return (
    <ReportPeriodField
      control={control}
      periodStartError={withFormErrors ? errors.periodStart?.message : periodStartError}
      periodEndError={withFormErrors ? errors.periodEnd?.message : periodEndError}
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

  // RPT-FE-043: 開始日フィールドでフォーカスアウトすると RHF の onBlur バリデーションが発火し、
  // 「開始日を入力してください」エラーが表示される（issue 119 修正確認）。
  it('RPT-FE-043: 開始日フォーカスアウトで RHF の onBlur バリデーションが発火し必須エラーが表示される', async () => {
    const user = userEvent.setup();
    render(<Wrapper withFormErrors />);

    const startInput = screen.getByLabelText('開始日');
    // フォーカスを当ててからフォーカスアウトする（値は空のまま）。
    await user.click(startInput);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('開始日を入力してください')).toBeInTheDocument();
    });
  });

  // RPT-FE-044: 終了日フィールドでフォーカスアウトすると RHF の onBlur バリデーションが発火し、
  // 「終了日を入力してください」エラーが表示される（issue 119 修正確認）。
  it('RPT-FE-044: 終了日フォーカスアウトで RHF の onBlur バリデーションが発火し必須エラーが表示される', async () => {
    const user = userEvent.setup();
    render(<Wrapper withFormErrors />);

    const endInput = screen.getByLabelText('終了日');
    // フォーカスを当ててからフォーカスアウトする（値は空のまま）。
    await user.click(endInput);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('終了日を入力してください')).toBeInTheDocument();
    });
  });
});
