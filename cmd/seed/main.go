// Package main は開発用フィクスチャをローカル DB に投入するスタンドアロン CLI。
// DATABASE_URL 環境変数（expense_owner ロール）を読み込んで seed.Run() を実行する。
// 冪等性を担保しているため、複数回実行しても既存データを破壊しない。
//
// S3_ENDPOINT 環境変数が設定されている場合、MinIO にダミーファイルをアップロードする。
// S3_ENDPOINT が未設定の場合、MinIO アップロードをスキップして DB レコードのみ投入する。
//
// 使用方法:
//
//	DATABASE_URL="postgres://expense_owner:localdev@localhost:5432/expense_saas?sslmode=disable" go run ./cmd/seed
//	または
//	make seed
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/pkg/s3"
	"expense-saas/internal/seed"
)

func main() {
	// DATABASE_URL はオーナーロール（expense_owner）の接続 URL を使用する。
	// RLS をバイパスするためにオーナーロールが必要。
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		fmt.Fprintln(os.Stderr, "エラー: 環境変数 DATABASE_URL が設定されていません")
		fmt.Fprintln(os.Stderr, "例: DATABASE_URL=postgres://expense_owner:localdev@localhost:5432/expense_saas?sslmode=disable make seed")
		os.Exit(1)
	}

	// JSON 構造化ログを設定する。
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	ctx := context.Background()

	slog.Info("シード投入を開始します", "database_url", maskPassword(databaseURL))

	// DB 接続プールを作成する。
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		slog.Error("DB 接続プールの作成に失敗しました", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// DB 疎通確認。
	if err := pool.Ping(ctx); err != nil {
		slog.Error("DB への接続確認に失敗しました。DB が起動しているか、DATABASE_URL が正しいか確認してください", "error", err)
		os.Exit(1)
	}
	slog.Info("DB 接続確認完了")

	// S3 クライアントを初期化する。
	// S3_ENDPOINT が未設定の場合は nil を渡し、MinIO アップロードをスキップする。
	var s3Client *s3.Client
	if os.Getenv("S3_ENDPOINT") != "" {
		s3Client, err = s3.NewClientFromEnv()
		if err != nil {
			slog.Error("S3 クライアントの初期化に失敗しました", "error", err)
			os.Exit(1)
		}
		slog.Info("S3 クライアント初期化完了", "endpoint", os.Getenv("S3_ENDPOINT"), "bucket", os.Getenv("S3_BUCKET"))
	} else {
		slog.Info("S3_ENDPOINT が未設定のため MinIO アップロードをスキップします")
	}

	// フィクスチャを投入する。
	if err := seed.Run(ctx, pool, s3Client); err != nil {
		slog.Error("フィクスチャ投入に失敗しました", "error", err)
		os.Exit(1)
	}

	slog.Info("フィクスチャ投入が完了しました")
	slog.Info("投入済みアカウント",
		"admin", "test-admin@example.com",
		"approver", "test-approver@example.com",
		"member", "test-member@example.com",
		"accounting", "test-accounting@example.com",
		"password", "TestPass1!",
	)
	slog.Info("投入済み添付ファイル（reportSubmitted）",
		"attachment_id", seed.AttachmentSubmittedID,
		"report_id", seed.ReportSubmittedID,
		"s3_key", seed.TenantAID+"/"+seed.ReportSubmittedID+"/"+seed.AttachmentSubmittedID,
	)
	slog.Info("投入済み添付ファイル（reportDraft）",
		"attachment_id", seed.AttachmentDraftID,
		"report_id", seed.ReportDraftID,
		"s3_key", seed.TenantAID+"/"+seed.ReportDraftID+"/"+seed.AttachmentDraftID,
	)
}

// maskPassword は接続 URL のパスワード部分を * にマスクして返す。
// ログ出力時のシークレット漏洩を防ぐ。
func maskPassword(databaseURL string) string {
	// 簡易的に "://user:password@" の password 部分を隠す。
	// pgx の URL パーサーに依存せず、単純な文字列置換で対応。
	masked := ""
	inPassword := false
	colonCount := 0
	for i, c := range databaseURL {
		switch {
		case c == ':' && !inPassword:
			colonCount++
			if colonCount == 2 {
				// 2 番目のコロン以降がパスワード開始。
				inPassword = true
				masked += string(c)
			} else {
				masked += string(c)
			}
		case inPassword && c == '@':
			// パスワード終了。
			inPassword = false
			masked += "****@"
		case inPassword:
			// パスワード文字はマスクする。
			_ = i
		default:
			masked += string(c)
		}
	}
	return masked
}
