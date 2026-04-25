// ReportPeriodField コンポーネントのユニットテスト。
// RPT-FE-039〜042、RPT-FE-103〜104、RPT-FE-107、RPT-FE-110 に対応する。
// RPT-FE-103〜104: issue 119（onBlur 伝播）修正確認テスト。
// RPT-FE-107: issue 141（開始日 onBlur でも V5 発火・フィールド別文言）追加テスト。
// RPT-FE-110: issue 141 / PR #95 codex 指摘対応（trigger を両方入力済み時のみに限定し、
//             未操作側に V3/V4 の必須エラーが先出しされないことを保証）。

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
  /** フォームの初期値（onBlur テスト時に既存値をプリフィルするために使用） */
  defaultValues?: Partial<ReportFormValues>;
}

function Wrapper({ periodStartError, periodEndError, disabled, withFormErrors, defaultValues }: WrapperProps) {
  const { control, trigger, getValues, formState: { errors } } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { title: '', periodStart: '', periodEnd: '', ...defaultValues },
    mode: 'onBlur',
  });
  return (
    <ReportPeriodField
      control={control}
      trigger={trigger}
      getValues={getValues}
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
  // 文言を「終了日は開始日以降を指定してください」に統一（issue #141 対応）。
  it('RPT-FE-041: periodEndError があると終了日にエラーメッセージが表示される', () => {
    render(<Wrapper periodEndError="終了日は開始日以降を指定してください" />);

    expect(screen.getByText('終了日は開始日以降を指定してください')).toBeInTheDocument();
  });

  // RPT-FE-042: disabled=true のとき両方の AppDatePicker が disabled になる。
  it('RPT-FE-042: disabled=true のとき両方の AppDatePicker が disabled になる', () => {
    render(<Wrapper disabled={true} />);

    expect(screen.getByLabelText('開始日')).toBeDisabled();
    expect(screen.getByLabelText('終了日')).toBeDisabled();
  });

  // RPT-FE-103: 開始日フィールドでフォーカスアウトすると RHF の onBlur バリデーションが発火し、
  // 「開始日を入力してください」エラーが表示される（issue 119 修正確認）。
  it('RPT-FE-103: 開始日フォーカスアウトで RHF の onBlur バリデーションが発火し必須エラーが表示される', async () => {
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

  // RPT-FE-104: 終了日フィールドでフォーカスアウトすると RHF の onBlur バリデーションが発火し、
  // 「終了日を入力してください」エラーが表示される（issue 119 修正確認）。
  it('RPT-FE-104: 終了日フォーカスアウトで RHF の onBlur バリデーションが発火し必須エラーが表示される', async () => {
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

  // RPT-FE-107: 開始日 blur で V5-S が発火し開始日フィールド直下に「開始日は終了日以前を指定してください」が
  // 表示され、終了日フィールド直下にも「終了日は開始日以降を指定してください」が同時表示される（issue #141）。
  // trigger(['periodStart', 'periodEnd']) により両 refine 経路が再評価されることを保証する。
  it('RPT-FE-107: 開始日 blur で periodStart > periodEnd のとき開始日・終了日両方にフィールド別文言が表示される', async () => {
    const user = userEvent.setup();
    // periodStart = "2026-04-30"（> periodEnd）の状態でコンポーネントをレンダリング。
    // defaultValues でプリフィルし、開始日フィールドのみフォーカスアウトして trigger が発火することを確認する。
    render(
      <Wrapper
        withFormErrors
        defaultValues={{ title: 'テスト', periodStart: '2026-04-30', periodEnd: '2026-04-01' }}
      />
    );

    const startInput = screen.getByLabelText('開始日');
    // 開始日フィールドにフォーカスを当ててからフォーカスアウトする。
    await user.click(startInput);
    await user.tab();

    // 開始日フィールド直下: V5-S 文言が表示される。
    await waitFor(() => {
      expect(screen.getByText('開始日は終了日以前を指定してください')).toBeInTheDocument();
    });
    // 終了日フィールド直下: V5-E 文言が同時に表示される（trigger(['periodStart', 'periodEnd']) により両経路が評価される）。
    expect(screen.getByText('終了日は開始日以降を指定してください')).toBeInTheDocument();
  });

  // RPT-FE-110: 開始日のみ入力済み（終了日空）の状態で開始日 blur しても、未操作の終了日に
  // V4 必須エラー「終了日を入力してください」が先出しされないこと（PR #95 codex 指摘対応）。
  // 修正前は trigger(['periodStart', 'periodEnd']) を無条件に呼んでおり、未操作の終了日に
  // V4 が即時表示されてしまい、設計書 §4 V4「終了日のフォーカスアウト / 送信時」の要件に
  // 反していた。修正後は両フィールド入力済みの場合のみ trigger を呼ぶため、未操作側には
  // V3/V4 が走らない。
  it('RPT-FE-110: 開始日のみ入力済みで開始日 blur したとき未操作の終了日に必須エラーが先出しされない', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper
        withFormErrors
        defaultValues={{ title: 'テスト', periodStart: '2026-04-01', periodEnd: '' }}
      />
    );

    const startInput = screen.getByLabelText('開始日');
    // 開始日（既入力）にフォーカスを当ててからフォーカスアウトする。
    await user.click(startInput);
    await user.tab();

    // 当該フィールド（開始日）の通常バリデーションは走るが、値が入っているため必須エラーは表示されない。
    // 重要: 未操作の終了日に V4 必須エラーが先出しされないこと。
    await waitFor(() => {
      expect(screen.queryByText('終了日を入力してください')).not.toBeInTheDocument();
    });
    // 副次確認: 開始日にも必須エラーは表示されない（値が入力済みのため V3 不発火）。
    expect(screen.queryByText('開始日を入力してください')).not.toBeInTheDocument();
  });
});
