package main

import (
	"embed"
	"io/fs"
	"log/slog"
)

// frontendDist は Vite build 成果物（frontend/dist/）を埋め込む。
// Dockerfile の Go builder stage で以下のコピーを行うことでこのディレクティブが成立する:
//
//	COPY --from=frontend-builder /build/frontend/dist ./cmd/server/frontend/dist
//
// この go:embed ディレクティブのパターンは、ソースファイル（embed.go）のディレクトリ（cmd/server/）を起点とした
// 相対パスであり、".." を含むパターンは使用不可のため、frontend/dist を cmd/server/ 配下に配置する。
//
//go:embed all:frontend/dist
var frontendDist embed.FS

// frontendDistFS は embed.FS から frontend/dist/ をルートとしたサブ FS を返す。
// http.FileServer に渡すためにサブ FS に変換する。
func frontendDistFS() fs.FS {
	sub, err := fs.Sub(frontendDist, "frontend/dist")
	if err != nil {
		// embed.FS の構造が Dockerfile のコピー先と一致していない場合に発生する。
		// サーバー起動前に検出するためパニックではなく Fatal ログで終了する。
		slog.Error("frontend/dist サブ FS の作成に失敗しました", "error", err)
		panic(err)
	}
	return sub
}
