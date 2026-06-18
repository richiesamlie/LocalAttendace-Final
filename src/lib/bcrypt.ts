import bcrypt from 'bcrypt';

/**
 * F-002: Centralized bcrypt cost factor.
 *
 * Default = 12 rounds (was 10). At 12 rounds, brute-force is ~4x slower
 * per attempt than 10 rounds — ~250ms per hash on a modern CPU. Login
 * UX impact: ~250ms extra on first POST /login per session.
 *
 * Override at startup: BCRYPT_COST=11 npm start
 * (lower the cost for slow hardware; never below 10 in production)
 *
 * Migration: existing 10-round hashes still verify via bcrypt.compare()
 * (the algorithm self-identifies rounds in the stored hash). New passwords
 * always use the current BCRYPT_COST. On next successful login, the
 * stored hash is re-hashed with BCRYPT_COST if it was below the target.
 */
export const BCRYPT_COST: number = (() => {
  const raw = process.env.BCRYPT_COST;
  if (!raw) return 12;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 4 || parsed > 15) {
    console.warn(`[bcrypt] Invalid BCRYPT_COST='${raw}', using default 12`);
    return 12;
  }
  return parsed;
})();

/**
 * Hash a plaintext password with the configured cost factor.
 * Use this everywhere a password hash is created or rotated.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 * Cost factor is auto-detected from the hash prefix; works for any
 * legacy round count.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Returns true if the stored hash was created with fewer rounds than
 * the current BCRYPT_COST. Used to trigger transparent re-hashing on
 * next successful login.
 */
export function needsRehash(hash: string): boolean {
  try {
    // bcrypt hash format: $2b$<cost>$<salt+hash>
    // Extract the cost segment
    const parts = hash.split('$');
    if (parts.length < 4) return false;
    const storedCost = parseInt(parts[2], 10);
    if (isNaN(storedCost)) return false;
    return storedCost < BCRYPT_COST;
  } catch {
    return false;
  }
}