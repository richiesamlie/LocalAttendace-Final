import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('Generic error messages (F-012)', () => {
  describe('invite redemption endpoint', () => {
    it('source uses a single generic error for all failure modes', () => {
      const src = readFileSync(join(process.cwd(), 'src/routes/invite.routes.ts'), 'utf8');
      // The 6 distinct failure messages should be replaced with 1 generic message
      expect(src).not.toMatch(/Invalid invite code['"]\s*\}\s*\)/);
      expect(src).not.toMatch(/already been used['"]\s*\}\s*\)/);
      expect(src).not.toMatch(/has expired['"]\s*\}\s*\)/);
      expect(src).not.toMatch(/class no longer exists['"]\s*\}\s*\)/);
      expect(src).not.toMatch(/already have access to this class['"]\s*\}\s*\)/);
      // The generic message should be present
      expect(src).toContain('Invalid or expired invite code');
    });

    it('GENERIC_INVITE_ERROR constant is used at all failure return sites', () => {
      const src = readFileSync(join(process.cwd(), 'src/routes/invite.routes.ts'), 'utf8');
      // Count return statements inside the /redeem handler that use the generic error
      const genericReferences = src.match(/GENERIC_INVITE_ERROR/g) || [];
      // The constant is defined once + used at all 5 failure points
      expect(genericReferences.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('other high-leak endpoints', () => {
    it('login endpoint already returns generic Invalid credentials', () => {
      const src = readFileSync(join(process.cwd(), 'src/routes/auth.routes.ts'), 'utf8');
      // All login failure paths should use 'Invalid credentials'
      const invalidCredsCount = (src.match(/Invalid credentials/g) || []).length;
      expect(invalidCredsCount).toBeGreaterThanOrEqual(3);
      // Should NOT have separate 'User not found' / 'Wrong password' messages
      expect(src).not.toMatch(/User not found/);
      expect(src).not.toMatch(/Wrong password/);
    });

    it('refresh endpoint returns generic error on reuse detection (not detailed reason)', () => {
      const src = readFileSync(join(process.cwd(), 'src/routes/auth.routes.ts'), 'utf8');
      expect(src).toContain('reuse detected');
    });
  });
});

describe('Log redaction is in place (cross-check F-007 + F-012)', () => {
  it('safeLog is used in profile-query error handler (F-007 + F-012)', () => {
    const src = readFileSync(join(process.cwd(), 'src/routes/admin.routes.ts'), 'utf8');
    expect(src).toContain('safeLog(error)');
    // The response should NOT echo raw error.message
    expect(src).not.toMatch(/error\.message\s*\?\s*error\.message/);
  });
});