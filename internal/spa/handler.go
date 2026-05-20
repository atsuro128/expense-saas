package spa

import (
	"io/fs"
	"net/http"
	"path/filepath"
)

// Handler は embed.FS から Vite build 成果物を配信する SPA fallback ハンドラを返す。
//
// ルーティング方針:
//   - リクエストパスに拡張子がある場合（例: .js/.css/.png）は embed.FS 内のファイルを直接返す。
//     ファイルが存在しなければ 404 を返す（fallback しない）。
//   - 拡張子がないパス（例: /、/some/spa/route）は常に index.html を返す（SPA fallback）。
//
// これにより、React Router のクライアントサイドルーティングが正常に機能する。
func Handler(distFS fs.FS) http.HandlerFunc {
	fileServer := http.FileServer(http.FS(distFS))

	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// 拡張子があるパス（静的アセット）はファイルサーバで直接処理する。
		// ファイルが存在しなければ http.FileServer が 404 を返す。
		ext := filepath.Ext(path)
		if ext != "" {
			fileServer.ServeHTTP(w, r)
			return
		}

		// 拡張子なしのパスは SPA fallback: index.html を返す。
		serveIndexHTML(distFS, w, r)
	}
}

// serveIndexHTML は embed.FS から index.html を返す。
// Content-Type を text/html に明示し、SPA ページのキャッシュを抑制する。
func serveIndexHTML(distFS fs.FS, w http.ResponseWriter, r *http.Request) {
	// index.html が FS 内に存在するかを確認する。
	if _, err := fs.Stat(distFS, "index.html"); err != nil {
		http.NotFound(w, r)
		return
	}

	// X-Content-Type-Options: nosniff が設定されているため Content-Type を明示する。
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	// SPA の index.html は CDN / ブラウザキャッシュで古いバージョンが返されないよう no-cache を設定する。
	// 静的アセット（JS/CSS）はハッシュ付きファイル名のため長期キャッシュ可能だが、
	// index.html は常に最新を返す必要がある。
	w.Header().Set("Cache-Control", "no-cache")

	// URL パスを "/" にリライトして http.FileServer に index.html を返させる。
	r2 := r.Clone(r.Context())
	r2.URL.Path = "/"
	http.FileServer(http.FS(distFS)).ServeHTTP(w, r2)
}
