package middleware

import (
	"context"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// limiterEntry はトークンバケット方式のレートリミッターに最終アクセス時刻を付与したラッパーです。
// 定期的な古いエントリのクリーンアップに使用します。
type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
	mu       sync.Mutex
}

// rateLimitStore はキーごとのレートリミッターをバックグラウンドクリーンアップ付きで管理します。
type rateLimitStore struct {
	mu       sync.Map
	limit    rate.Limit
	burst    int
	interval time.Duration
}

func newRateLimitStore(limit int, window time.Duration) *rateLimitStore {
	// レートを算出する: ウィンドウあたり limit リクエスト。
	r := rate.Every(window / time.Duration(limit))
	return &rateLimitStore{
		limit:    r,
		burst:    limit,
		interval: window,
	}
}

// get は指定されたキーのレートリミッターを返します（存在しない場合は遅延生成します）。
func (s *rateLimitStore) get(key string) *rate.Limiter {
	now := time.Now()
	val, _ := s.mu.LoadOrStore(key, &limiterEntry{
		limiter:  rate.NewLimiter(s.limit, s.burst),
		lastSeen: now,
	})
	entry := val.(*limiterEntry)
	entry.mu.Lock()
	entry.lastSeen = now
	entry.mu.Unlock()
	return entry.limiter
}

// cleanup はウィンドウの 2 倍の期間アクセスされなかったエントリを削除します。
func (s *rateLimitStore) cleanup(ttl time.Duration) {
	cutoff := time.Now().Add(-ttl)
	s.mu.Range(func(key, value any) bool {
		entry := value.(*limiterEntry)
		entry.mu.Lock()
		stale := entry.lastSeen.Before(cutoff)
		entry.mu.Unlock()
		if stale {
			s.mu.Delete(key)
		}
		return true
	})
}

// startCleanup は古いエントリを定期的に削除するバックグラウンド goroutine を起動します。
// ctx がキャンセルされると停止します。
func startCleanup(ctx context.Context, store *rateLimitStore) {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				slog.Info("rate limiter cleanup stopped")
				return
			case <-ticker.C:
				store.cleanup(store.interval * 2)
			}
		}
	}()
}

// setRateLimitHeaders はレスポンスに X-RateLimit-* ヘッダーを付与します。
// remaining は現在利用可能なトークン数（下限 0）、resetAt はウィンドウがリセットされる概算時刻です。
func setRateLimitHeaders(w http.ResponseWriter, limit int, l *rate.Limiter, window time.Duration) {
	remaining := int(math.Max(0, math.Floor(l.Tokens())))
	resetAt := time.Now().Add(window).Unix()
	h := w.Header()
	h.Set("X-RateLimit-Limit", strconv.Itoa(limit))
	h.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	h.Set("X-RateLimit-Reset", strconv.FormatInt(resetAt, 10))
}

// respond429 は Retry-After ヘッダー付きの 429 Too Many Requests レスポンスを書き込みます。
func respond429(w http.ResponseWriter, retryAfter int) {
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	RespondError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.")
}

// RateLimitByIP は IP アドレスごとにレート制限を適用する middleware を返します。
// 未認証ルート向けを想定しています。
// ctx はバックグラウンドクリーンアップ goroutine のライフサイクルを制御します。
func RateLimitByIP(ctx context.Context, limit int, window time.Duration) func(http.Handler) http.Handler {
	store := newRateLimitStore(limit, window)
	startCleanup(ctx, store)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := remoteIP(r)
			l := store.get(ip)
			setRateLimitHeaders(w, limit, l, window)
			if !l.Allow() {
				retryAfter := int(window.Seconds() / float64(limit))
				if retryAfter < 1 {
					retryAfter = 1
				}
				respond429(w, retryAfter)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RateLimitByUser はユーザーごとにレート制限を適用する middleware を返します。
// コンテキストにユーザー ID が設定された認証済みルート向けを想定しています。
// ユーザー ID が存在しない場合は IP ベースの制限にフォールバックします。
// ctx はバックグラウンドクリーンアップ goroutine のライフサイクルを制御します。
func RateLimitByUser(ctx context.Context, limit int, window time.Duration) func(http.Handler) http.Handler {
	store := newRateLimitStore(limit, window)
	startCleanup(ctx, store)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := GetUserID(r.Context())
			if key == "" {
				key = "ip:" + remoteIP(r)
			}
			// テナント横断でキーが衝突しないよう、テナント ID を結合する。
			if tid := GetTenantID(r.Context()); tid != "" {
				key = strings.Join([]string{tid, key}, ":")
			}

			l := store.get(key)
			setRateLimitHeaders(w, limit, l, window)
			if !l.Allow() {
				retryAfter := int(window.Seconds() / float64(limit))
				if retryAfter < 1 {
					retryAfter = 1
				}
				respond429(w, retryAfter)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
