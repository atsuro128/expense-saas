#!/bin/bash
# PostToolUse hook: Edit/Write 後に自動 format + 軽量 lint を実行
# exit 0: 成功（format 適用済み）
# exit 2: lint エラー（ブロック）

set -euo pipefail

# stdin から JSON を読み取り file_path を取得
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# expense-saas/ 配下でなければスキップ
case "$FILE_PATH" in
  */expense-saas/*)
    ;;
  *)
    exit 0
    ;;
esac

# ファイルが存在しなければスキップ（削除操作等）
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# expense-saas のルートディレクトリを特定
EXPENSE_ROOT=$(echo "$FILE_PATH" | sed 's|\(.*expense-saas\)/.*|\1|')

case "$FILE_PATH" in
  *.go)
    # Go: gofmt で自動 format
    gofmt -w "$FILE_PATH" 2>/dev/null || true

    # Go: go vet で軽量 lint（パッケージ単位）
    PKG_DIR=$(dirname "$FILE_PATH")
    cd "$EXPENSE_ROOT"
    REL_PKG="./${PKG_DIR#$EXPENSE_ROOT/}"
    if ! go vet "$REL_PKG" 2>&1; then
      echo "go vet failed for $REL_PKG" >&2
      exit 2
    fi
    ;;

  *.ts|*.tsx)
    # TypeScript: prettier で自動 format
    FRONTEND_DIR="$EXPENSE_ROOT/frontend"
    if [ -d "$FRONTEND_DIR/node_modules/.bin" ]; then
      "$FRONTEND_DIR/node_modules/.bin/prettier" --write "$FILE_PATH" 2>/dev/null || true

      # TypeScript: tsc --noEmit で型チェック
      cd "$FRONTEND_DIR"
      if ! npx tsc --noEmit 2>&1; then
        echo "tsc --noEmit failed" >&2
        exit 2
      fi
    fi
    ;;
esac

exit 0
