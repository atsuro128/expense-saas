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

// limiterEntry wraps a token-bucket rate limiter with a last-seen timestamp
// to allow periodic cleanup of stale entries.
type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
	mu       sync.Mutex
}

// rateLimitStore manages per-key rate limiters with background cleanup.
type rateLimitStore struct {
	mu       sync.Map
	limit    rate.Limit
	burst    int
	interval time.Duration
}

func newRateLimitStore(limit int, window time.Duration) *rateLimitStore {
	// Calculate rate: limit requests per window.
	r := rate.Every(window / time.Duration(limit))
	return &rateLimitStore{
		limit:    r,
		burst:    limit,
		interval: window,
	}
}

// get returns (or lazily creates) a rate limiter for the given key.
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

// cleanup removes entries that have not been accessed within 2x the window.
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

// startCleanup launches a background goroutine that periodically purges old entries.
// It stops when ctx is cancelled.
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

// setRateLimitHeaders attaches X-RateLimit-* headers to the response.
// remaining is the number of tokens currently available (floored at 0).
// resetAt is the approximate time when the window resets.
func setRateLimitHeaders(w http.ResponseWriter, limit int, l *rate.Limiter, window time.Duration) {
	remaining := int(math.Max(0, math.Floor(l.Tokens())))
	resetAt := time.Now().Add(window).Unix()
	h := w.Header()
	h.Set("X-RateLimit-Limit", strconv.Itoa(limit))
	h.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	h.Set("X-RateLimit-Reset", strconv.FormatInt(resetAt, 10))
}

// respond429 writes a 429 Too Many Requests response with Retry-After header.
func respond429(w http.ResponseWriter, retryAfter int) {
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	RespondError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.")
}

// RateLimitByIP returns a middleware that enforces a per-IP rate limit.
// Intended for unauthenticated routes.
// ctx controls the lifecycle of the background cleanup goroutine.
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

// RateLimitByUser returns a middleware that enforces a per-user rate limit.
// Intended for authenticated routes where the user ID is set in context.
// Falls back to IP-based limiting when no user ID is present.
// ctx controls the lifecycle of the background cleanup goroutine.
func RateLimitByUser(ctx context.Context, limit int, window time.Duration) func(http.Handler) http.Handler {
	store := newRateLimitStore(limit, window)
	startCleanup(ctx, store)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := GetUserID(r.Context())
			if key == "" {
				key = "ip:" + remoteIP(r)
			}
			// Combine with tenant to prevent cross-tenant key collision.
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
