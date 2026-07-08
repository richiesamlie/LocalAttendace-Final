import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AUTH_COOKIE_NAME, COOKIE_SECURE, parseAuthTokenCookie } from '../../../src/routes/middleware';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('AUTH_COOKIE_NAME + __Host- prefix (F-020)', () => {
  it('AUTH_COOKIE_NAME is the plain name in non-production env', () => {
    // Vitest sets NODE_ENV=test by default.
    expect(AUTH_COOKIE_NAME).toBe('auth_token');
    expect(COOKIE_SECURE).toBe(false);
  });

  it('parseAuthTokenCookie finds the cookie under the default name', () => {
    expect(parseAuthTokenCookie('auth_token=abc123')).toBe('abc123');
    expect(parseAuthTokenCookie('other=x; auth_token=abc123; theme=dark')).toBe('abc123');
  });

  it('parseAuthTokenCookie accepts a custom cookie name (production scenario)', () => {
    // Simulate a production-style cookie header using the __Host- prefix.
    expect(parseAuthTokenCookie('__Host-auth_token=prod-tok', '__Host-auth_token')).toBe('prod-tok');
  });

  it('parseAuthTokenCookie does NOT find __Host- prefixed cookie when looking for plain name', () => {
    // In production, the cookie is __Host-auth_token but the dev fallback
    // path would look for plain auth_token. With the production code, the
    // AUTH_COOKIE_NAME constant IS the __Host- one and parseAuthTokenCookie
    // uses it. This test asserts the two names are intentionally distinct.
    const plain = parseAuthTokenCookie('__Host-auth_token=prod-tok');
    expect(plain).toBeNull();
  });

  it('source code uses AUTH_COOKIE_NAME constant in all cookie paths', () => {
    // Defense-in-depth: ensures no regression to hardcoded 'auth_token'
    // string literals in the source.
    const middlewareSrc = readFileSync(
      join(process.cwd(), 'src/routes/middleware.ts'),
      'utf8',
    );
    const authRoutesSrc = readFileSync(
      join(process.cwd(), 'src/routes/auth.routes.ts'),
      'utf8',
    );
    // The string literal 'auth_token' should appear ONLY as part of the
    // AUTH_COOKIE_NAME definition (the ternary returning 'auth_token' for
    // non-prod). All other cookie references should use the constant.
    const middlewareMatches = middlewareSrc.match(/['"]auth_token['"]/g) || [];
    const authRoutesMatches = authRoutesSrc.match(/['"]auth_token['"]/g) || [];

    // The middleware.ts should have exactly 1 occurrence (the AUTH_COOKIE_NAME
    // ternary fallback) and auth.routes.ts should have 0 occurrences.
    expect(middlewareMatches.length).toBeLessThanOrEqual(1);
    expect(authRoutesMatches.length).toBe(0);

    // Both should use AUTH_COOKIE_NAME constant
    expect(middlewareSrc).toContain('AUTH_COOKIE_NAME');
    expect(authRoutesSrc).toContain('AUTH_COOKIE_NAME');
  });
});
