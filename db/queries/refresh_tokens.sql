-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (jti, user_id, token_hash, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetRefreshTokenByJTI :one
SELECT * FROM refresh_tokens
WHERE jti = $1;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens
SET is_revoked = true
WHERE jti = $1;
