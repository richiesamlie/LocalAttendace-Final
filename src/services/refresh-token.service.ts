import { createHash, randomBytes, randomUUID } from 'crypto';
import { db, isPostgres, pgQuery, pgQueryOne, getPool } from './utils';

/**
 * Refresh Token Service
 *
 * F-004: implements single-use refresh tokens with rotation and family
 * revocation on reuse detection.
 *
 * Token shape:
 *   raw_value = 'rt_<32-byte-hex>' (48 hex chars after 'rt_' prefix)
 *   sha256_hash = sha256(raw_value) — stored in DB, never the raw value
 *   The raw value is what's sent in the cookie; only the hash is persisted.
 *
 * Rotation chain:
 *   issue() → token A (used_at=NULL)
 *   rotate(A) → token B (used_at=NULL), A.used_at=SET, A.rotated_to=B.id
 *   If A is presented again (used_at already set) → reuse detected →
 *   revokeFamily() marks ALL tokens in the family as used.
 */

const REFRESH_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RAW_TOKEN_BYTES = 32;
const TOKEN_PREFIX = 'rt_';

export interface RefreshTokenRow {
  id: string;
  family_id: string;
  token_hash: string;
  teacher_id: string;
  session_id: string;
  expires_at: string;
  used_at: string | null;
  rotated_to: string | null;
}

export interface IssuedRefreshToken {
  rawValue: string;
  tokenHash: string;
  id: string;
  familyId: string;
  expiresAt: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateRawToken(): string {
  return TOKEN_PREFIX + randomBytes(RAW_TOKEN_BYTES).toString('hex');
}

function lifetimeIso(): string {
  return new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS).toISOString();
}

export const refreshTokenService = {
  /**
   * Issue a new refresh token in a fresh family (login flow) or add a
   * new token to an existing family (caller specifies).
   *
   * Returns the raw token value (caller puts this in the cookie) AND
   * the row metadata (so the caller can log/inspect without a re-read).
   */
  issue(
    teacherId: string,
    sessionId: string,
    familyId: string = randomUUID(),
  ): IssuedRefreshToken & PromiseLike<IssuedRefreshToken> {
    const id = randomUUID();
    const rawValue = generateRawToken();
    const tokenHash = sha256(rawValue);
    const expiresAt = lifetimeIso();
    const issued: IssuedRefreshToken = { rawValue, tokenHash, id, familyId, expiresAt };

    if (isPostgres()) {
      const p = pgQuery(
        `INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, familyId, tokenHash, teacherId, sessionId, expiresAt],
      )
        .then(() => issued)
        .catch((err) => {
          console.error('[refresh-token] Failed to insert refresh token in Postgres:', err);
          return issued;
        });
      return Object.assign(p, issued);
    }

    db.stmt.insertRefreshToken.run(id, familyId, tokenHash, teacherId, sessionId, expiresAt);
    const resolved = Promise.resolve(issued);
    return Object.assign(resolved, issued);
  },

  /**
   * Look up a refresh token by the raw cookie value (hashes internally).
   * Returns the row if found and not yet expired; null otherwise.
   * Does NOT check used_at — caller decides what to do with already-used tokens.
   */
  async findByRawValue(rawValue: string): Promise<RefreshTokenRow | null> {
    if (!rawValue || !rawValue.startsWith(TOKEN_PREFIX)) return null;
    const tokenHash = sha256(rawValue);

    if (isPostgres()) {
      return pgQueryOne<RefreshTokenRow>(
        `SELECT id, family_id, token_hash, teacher_id, session_id, expires_at, used_at, rotated_to
         FROM refresh_tokens WHERE token_hash = $1`,
        [tokenHash],
      );
    }
    return (db.stmt.getRefreshTokenByHash.get(tokenHash) as RefreshTokenRow | undefined) || null;
  },

  /**
   * Atomically mark a token as used and link it to its successor. Returns
   * true if the UPDATE affected a row (we won the rotation race); false
   * if the token was already used (race lost).
   *
   * F-004: if called with a token that already has used_at set, this
   * returns false WITHOUT modifying anything — caller should treat this
   * as reuse-detected and call revokeFamily.
   */
  async rotate(oldTokenId: string, successorId: string): Promise<boolean> {
    if (isPostgres()) {
      const result = await getPool().query(
        `UPDATE refresh_tokens SET used_at = NOW(), rotated_to = $1
         WHERE id = $2 AND used_at IS NULL`,
        [successorId, oldTokenId],
      );
      const rowCount = result.rowCount ?? 0;
      return rowCount === 1;
    }
    const info = db.stmt.markRefreshTokenUsed.run(successorId, oldTokenId) as { changes: number };
    return info.changes === 1;
  },

  /**
   * Mark every token in a family as used. Idempotent.
   * Called when reuse is detected OR on logout from a session that owns
   * tokens in the family.
   */
  revokeFamily(familyId: string): Promise<void> {
    if (isPostgres()) {
      return pgQuery(
        `UPDATE refresh_tokens SET used_at = NOW() WHERE family_id = $1 AND used_at IS NULL`,
        [familyId],
      )
        .then(() => undefined)
        .catch((err) => {
          console.error('[refresh-token] Failed to revoke family in Postgres:', err);
        });
    }
    db.stmt.revokeRefreshFamily.run(familyId);
    return Promise.resolve();
  },

  revokeAllForTeacher(teacherId: string): Promise<void> {
    if (isPostgres()) {
      return pgQuery(
        `UPDATE refresh_tokens SET used_at = NOW() WHERE teacher_id = $1 AND used_at IS NULL`,
        [teacherId],
      )
        .then(() => undefined)
        .catch((err) => {
          console.error('[refresh-token] Failed to revoke teacher tokens in Postgres:', err);
        });
    }
    try {
      db.prepare('UPDATE refresh_tokens SET used_at = CURRENT_TIMESTAMP WHERE teacher_id = ? AND used_at IS NULL').run(teacherId);
    } catch {
      /* non-critical */
    }
    return Promise.resolve();
  },

  /**
   * Best-effort cleanup of expired tokens. Safe to call periodically.
   */
  cleanup(): Promise<void> {
    if (isPostgres()) {
      return pgQuery(`DELETE FROM refresh_tokens WHERE expires_at::timestamptz < NOW()`)
        .then(() => undefined)
        .catch((err) => {
          console.error('[refresh-token] Failed to cleanup expired tokens in Postgres:', err);
        });
    }
    try {
      db.stmt.deleteExpiredRefreshTokens.run();
    } catch {
      /* non-critical */
    }
    return Promise.resolve();
  },

  /**
   * Count active (unused, unexpired) refresh tokens for a teacher. Used
   * for sanity / debugging, not as an authorization gate.
   */
  async countActiveForTeacher(teacherId: string): Promise<number> {
    if (isPostgres()) {
      const row = await pgQueryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM refresh_tokens
         WHERE teacher_id = $1 AND used_at IS NULL AND expires_at::timestamptz > NOW()`,
        [teacherId],
      );
      return parseInt(row?.count || '0', 10);
    }
    try {
      const row = db.stmt.countActiveRefreshTokensForTeacher.get(teacherId) as { count: number };
      return row.count;
    } catch {
      return 0;
    }
  },
};