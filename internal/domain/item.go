package domain

// ValidateAmount は経費明細の金額不変条件を検証する（ITM-002）。
// amount <= 0 の場合は ErrInvalidAmount を返す。
//
// Step 9: スタブ実装。Step 10 で本実装に置き換える。
func (i *ExpenseItem) ValidateAmount() error {
	if i.Amount <= 0 {
		return ErrInvalidAmount
	}
	return nil
}
