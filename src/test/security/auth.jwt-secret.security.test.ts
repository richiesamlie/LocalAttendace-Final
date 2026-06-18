import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { JWT_SECRET } from '../../../src/routes/middleware';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('JWT_SECRET hardening (F-005)', () => {
  it('exports a secret of at least 32 characters in test mode', () => {
    expect(typeof JWT_SECRET).toBe('string');
    expect(JWT_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('source code no longer contains the old hardcoded dev secret', () => {
    // Defense-in-depth: even if a future change accidentally re-introduces
    // a hardcoded fallback, this test will fail and surface the regression.
    const src = readFileSync(
      join(process.cwd(), 'src/routes/middleware.ts'),
      'utf8',
    );
    expect(src).not.toContain('dev-secret-change-in-production');
  });

  it('source code requires a min length of 32 chars on JWT_SECRET env', () => {
    // The new validation requires >= 32 chars to prevent weak secrets.
    const src = readFileSync(
      join(process.cwd(), 'src/routes/middleware.ts'),
      'utf8',
    );
    expect(src).toMatch(/fromEnv\.length\s*>=\s*32/);
  });

  it('source code throws clearly in production if JWT_SECRET missing', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/routes/middleware.ts'),
      'utf8',
    );
    expect(src).toContain("NODE_ENV === 'production'");
    expect(src).toContain('throw new Error');
    expect(src).toMatch(/JWT_SECRET.*must be set/i);
  });

  it('source code generates ephemeral random secret for dev (not hardcoded)', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/routes/middleware.ts'),
      'utf8',
    );
    expect(src).toContain('randomBytes(32)');
    expect(src).toContain('ephemeral');
  });
});