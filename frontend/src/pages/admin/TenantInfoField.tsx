// TenantInfoField: ラベルと値のペアを読み取り専用で表示するコンポーネント。
// MVP ではテナント情報は会社名のみだが、Phase 3 での項目追加に対応できる汎用設計とする。

/** TenantInfoField コンポーネントの Props。 */
interface TenantInfoFieldProps {
  /** フィールドのラベル */
  label: string;
  /** フィールドの値 */
  value: string;
}

/**
 * TenantInfoField はラベルと値のペアを表示するコンポーネント。
 */
export default function TenantInfoField({ label, value }: TenantInfoFieldProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
