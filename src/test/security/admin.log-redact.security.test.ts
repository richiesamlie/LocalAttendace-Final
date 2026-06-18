import { describe, it, expect } from 'vitest';
import { redactPII, safeLog } from '../../../src/lib/log-redact';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('Log redaction (F-007)', () => {
  describe('redactPII', () => {
    it('redacts email addresses', () => {
      const result = redactPII('User john@school.com not found');
      expect(result).toBe('User [REDACTED:email] not found');
      expect(result).not.toContain('john@school.com');
    });

    it('redacts multiple emails in one message', () => {
      const result = redactPII('Failed for admin@school.com and user@other.org');
      expect(result).toBe('Failed for [REDACTED:email] and [REDACTED:email]');
    });

    it('redacts bcrypt hashes', () => {
      const hash = '$2b$12$LJ3m4ys2Ped0YEOBqlp85Oe5qhV4P4YvMh3uZ3mXQ5xSxqkfVjWka';
      const result = redactPII(`hash: ${hash}`);
      expect(result).toBe('hash: [REDACTED:bcrypt-hash]');
      expect(result).not.toContain('$2b$');
    });

    it('redacts JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0Y2gtMTIzIn0.abcdefghijklmnop';
      const result = redactPII(`Auth: ${jwt}`);
      expect(result).toBe('Auth: [REDACTED:jwt]');
    });

    it('redacts long hex strings (potential tokens)', () => {
      const hexToken = 'a'.repeat(48);
      const result = redactPII(`token=${hexToken}`);
      expect(result).toContain('[REDACTED:hex-token]');
      expect(result).not.toContain(hexToken);
    });

    it('does NOT redact short hex strings (UUID fragments, etc.)', () => {
      const shortHex = 'abc123';
      const result = redactPII(`id: ${shortHex}`);
      expect(result).toBe(`id: ${shortHex}`);
    });

    it('returns empty string for null/undefined', () => {
      expect(redactPII(null)).toBe('');
      expect(redactPII(undefined)).toBe('');
      expect(redactPII('')).toBe('');
    });

    it('passes through messages with no PII unchanged', () => {
      const msg = 'Failed to query teachers table: no such column';
      expect(redactPII(msg)).toBe(msg);
    });

    it('redacts phone numbers (10+ digits)', () => {
      const result = redactPII('Contact +1-555-123-4567 or 081234567890');
      expect(result).not.toContain('555-123-4567');
      expect(result).not.toContain('081234567890');
      expect(result).toContain('[REDACTED:phone]');
    });
  });

  describe('safeLog', () => {
    it('redacts strings', () => {
      const result = safeLog('error for user@school.com');
      expect(result).not.toContain('user@school.com');
      expect(result).toContain('[REDACTED:email]');
    });

    it('redacts Error.message', () => {
      const error = new Error('Lookup failed for john@example.com');
      const result = safeLog(error);
      expect(result).toContain('Error');
      expect(result).not.toContain('john@example.com');
      expect(result).toContain('[REDACTED:email]');
    });

    it('handles non-Error non-string values via JSON.stringify', () => {
      const result = safeLog({ user: 'alice@school.com', code: 500 });
      expect(result).not.toContain('alice@school.com');
      expect(result).toContain('[REDACTED:email]');
    });

    it('handles circular references without throwing', () => {
      const obj: Record<string, unknown> = { user: 'bob@school.com' };
      obj.self = obj; // circular
      expect(() => safeLog(obj)).not.toThrow();
    });
  });

  describe('integration: simulates a SQL error with embedded PII', () => {
    it('strips PII from a realistic sqlite error message', () => {
      // Realistic shape of a SQLite error if a query references a parent_phone value
      const errorMsg = 'SqliteError: no such column: 081234567890 in "SELECT * FROM students WHERE parent_phone = 081234567890"';
      const result = redactPII(errorMsg);
      expect(result).not.toContain('081234567890');
      expect(result).toContain('[REDACTED:phone]');
    });

    it('strips PII from a "user not found" error', () => {
      const errorMsg = 'Teacher not found for email=admin@school.com';
      const result = redactPII(errorMsg);
      expect(result).toBe('Teacher not found for email=[REDACTED:email]');
    });
  });
});