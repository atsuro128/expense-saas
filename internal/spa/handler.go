package spa

import (
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"
)

// apiErrorBody は /api/* 未定義パスへの JSON 404 レスポンスのボディ構造体。
// middleware.ErrorResponse と同じ JSON 形式に揃える。
type apiErrorBody struct {
	Error apiErrorDetail `json:"error"`
}

type apiErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Handler は embed.FS から Vite build 成果物を配信する SPA fallback ハンドラを返す。
//
// ルーティング方針:
//   - リクエストパスが /api/ プレフィックスで始まる場合は JSON 404 を返す（SPA fallback しない）。
//     chi ルータで定義済みの /api/* ルートには到達しないため、ここに来た /api/* は未定義パスである。
//   - リクエストパスに拡張子がある場合（例: .js/.css/.png）は embed.FS 内のファイルを直接返す。
//     ファイルが存在しなければ 404 を返す（fallback しない）。
//   - 拡張子がないパス（例: /、/some/spa/route）は常に index.html を返す（SPA fallback）。
//
// これにより、React Router のクライアントサイドルーティングが正常に機能する。
//
// fail-fast: distFS に index.html が存在しない場合はサーバー起動時に panic する（embed スタブのまま
// 本番ビルドせずに起動するミスを早期検出するため）。
func Handler(distFS fs.FS) http.HandlerFunc {
	// warning-2 対応: 起動時に index.html の存在を確認する。
	// 存在しない場合は embed スタブのままビルドされた可能性が高いため fail-fast とする。
	if _, err := fs.Stat(distFS, "index.html"); err != nil {
		slog.Error("SPA の index.html が embed.FS に存在しません。frontend/dist をビルドしてください", "error", err)
		panic("spa: index.html not found in distFS")
	}

	// warning-1 対応: http.FileServer はリクエスト毎ではなく一度だけ生成してキャッシュする。
	fileServer := http.FileServer(http.FS(distFS))

	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// /api/ プレフィックスは API ルートとして扱う。
		// chi ルータで定義済みの /api/* パスには先にマッチするため、ここへ到達するのは未定義パスのみ。
		// SPA fallback させず、API エラーレスポンスと同形式の JSON 404 を返す（architecture.md §4.0）。
		if strings.HasPrefix(path, "/api/") {
			respondAPINotFound(w)
			return
		}

		// 拡張子があるパス（静的アセット）はファイルサーバで直接処理する。
		// ファイルが存在しなければ http.FileServer が 404 を返す。
		ext := filepath.Ext(path)
		if ext != "" {
			fileServer.ServeHTTP(w, r)
			return
		}

		// 拡張子なしのパスは SPA fallback: index.html を返す。
		serveIndexHTML(fileServer, w, r)
	}
}

// respondAPINotFound は未定義 /api/* パスへの JSON 404 レスポンスを返す。
// middleware.RespondError と同じ JSON 構造・Content-Type を使用する。
func respondAPINotFound(w http.ResponseWriter) {
	body := apiErrorBody{
		Error: apiErrorDetail{
			Code:    "NOT_FOUND",
			Message: "not found",
		},
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("SPA API 404 レスポンスの JSON エンコードに失敗しました", "error", err)
	}
}

// serveIndexHTML は embed.FS から index.html を返す。
// Content-Type を text/html に明示し、SPA ページのキャッシュを抑制する。
// fileServer は Handler で事前に生成されたインスタンスを受け取る（warning-1 対応）。
func serveIndexHTML(fileServer http.Handler, w http.ResponseWriter, r *http.Request) {
	// X-Content-Type-Options: nosniff が設定されているため Content-Type を明示する。
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	// SPA の index.html は CDN / ブラウザキャッシュで古いバージョンが返されないよう no-cache を設定する。
	// 静的アセット（JS/CSS）はハッシュ付きファイル名のため長期キャッシュ可能だが、
	// index.html は常に最新を返す必要がある。
	w.Header().Set("Cache-Control", "no-cache")

	// URL パスを "/" にリライトして http.FileServer に index.html を返させる。
	r2 := r.Clone(r.Context())
	r2.URL.Path = "/"
	fileServer.ServeHTTP(w, r2)
}
