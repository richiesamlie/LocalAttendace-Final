# F-004 Design — Refresh Token Rotation

> Branch: `develop`
> Mode: incremental, behavior-preserving for existing sessions (legacy fallback)

## Goals
1. Reduce access-token lifetime from 7 days to 1 hour
2. Introduce refresh tokens (7 days, opaque random, hashed at rest)
3. Rotate refresh tokens on every `/api/auth/refresh` call (single-use)
4. Detect refresh-token reuse → revoke entire family (theft mitigation)
5. Backwards compatible: legacy 7-day JWT still works during transition

## Design Decisions

### Token Types
| Token | Storage | Lifetime | Cookie |
|-------|----------|----------|--------|
| Access | JWT (signed) | 1 hour | `__Host-access_token` (prod) / `access_token` (dev) |
| Refresh | Opaque random (hashed in DB) | 7 days | `__Host-refresh_token` (prod) / `refresh_token` (dev) |

**Why opaque refresh (not JWT)?**
- JWTs can't be revoked without a blacklist → defeats the "rotate on use" model
- Refresh tokens MUST be checkable for "has this been rotated already?"
- Opaque random + DB row with `used_at` flag gives clean rotation primitive

### Rotation Chain (Family Model)
```
Login → refresh_token[id=A, family_id=F, used_at=NULL]
                       ↓ /refresh
refresh_token[id=B, family_id=F, used_at=NULL, rotated_to=id_of_B]
                       ↑ old A: used_at=SET, rotated_to=B
```

If `id=A` is presented AGAIN after `used_at` is set → **reuse detected → revoke ALL tokens in family F**.

### Schema (refresh_tokens table)
```sql
CREATE TABLE refresh_tokens (
  id          TEXT PRIMARY KEY,         -- 32-byte hex, sent as token value (after sha256 stored)
  family_id   TEXT NOT NULL,           -- All tokens in a rotation chain share this
  token_hash  TEXT NOT NULL UNIQUE,     -- sha256 of the actual cookie value
  teacher_id  TEXT NOT NULL,
  session_id  TEXT NOT NULL,           -- FK to user_sessions.id (for revocation cascade)
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,                    -- NULL=valid; SET=already rotated/revoked
  rotated_to  TEXT,                    -- FK to successor id in family
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE CASCADE
);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_teacher ON refresh_tokens(teacher_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

### Endpoint Surface

| Endpoint | Method | Auth | Behavior |
|----------|--------|------|----------|
| `/api/auth/login` | POST | (login) | Issues 1h access + 7d refresh cookie |
| `/api/auth/refresh` | POST | refresh cookie | Rotates refresh, returns new access+refresh cookies |
| `/api/auth/logout` | POST | access | Revokes refresh family, clears both cookies |

### Backwards Compat (Transition)
- Old `auth_token` cookie (7d JWT) is still accepted by middleware
- On any successful API call, log a deprecation warning
- Frontend migration: replace direct API calls with auto-refresh interceptor
- Old sessions still work but can't refresh (need re-login)

## Files To Change
1. `src/db/schema.ts` — add `refresh_tokens` table (idempotent CREATE IF NOT EXISTS)
2. `src/db/statements.ts` — prepared statements (insert, get, markUsed, rotateTo, revokeFamily)
3. `src/services/refresh-token.service.ts` — NEW (issue, rotate, findByHash, revokeFamily, cleanup)
4. `src/routes/middleware.ts` — `ACCESS_COOKIE_NAME` + `REFRESH_COOKIE_NAME` constants; legacy `AUTH_COOKIE_NAME` alias
5. `src/routes/auth.routes.ts` — login emits 2 cookies; new `/refresh` endpoint; logout clears both
6. `src/test/security/auth.refresh.security.test.ts` — NEW

## Commit Sequence (each commit independently testable)
1. Schema + service skeleton (table + refresh-token.service.ts)
2. Login emits both cookies; logout clears both
3. `/refresh` endpoint with rotation
4. Reuse detection test + family revocation
5. Middleware: read access_token from new cookie + legacy fallback
6. Tests + closeout

## Verification
- `npm run lint`: clean
- `npm run lint:eslint --max-warnings=0`: clean
- `npm run test:critical`: passes (10+ new tests for refresh flow)
- `npm run build`: vite + PWA still works
- `npm audit --omit=dev --audit-level=high`: still 0 HIGH

## Out of Scope (Future)
- Frontend auto-refresh interceptor (handled separately by frontend dev)
- Token theft detection beyond reuse-detection (IP fingerprinting, etc.)
- Per-device refresh token display in UI