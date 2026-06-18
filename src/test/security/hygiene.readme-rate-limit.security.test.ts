import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, resolve as resolvePath } from 'path';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

const findRepoRoot = (): string => {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'server.ts'))) return dir;
    const parent = resolvePath(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
};

const repoRoot = findRepoRoot();

describe('README rate-limit documentation sync (F-026)', () => {
  it('README exists', () => {
    expect(existsSync(join(repoRoot, 'README.md'))).toBe(true);
  });

  it('README documents current login rate limit (150/15min)', () => {
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
    // The README documents the current login limit (150/15min).
    // Format varies between rewrites: 'login: 150/15min' OR 'login 150/15min'
    expect(readme).toMatch(/login[:\s]+150/);
  });

  it('README documents current write rate limit (500/15min)', () => {
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
    // The README documents the current postLimiter value (500/15min).
    expect(readme).toMatch(/(writes|write|POST)[:\s]+500/);
  });

  it('README does NOT document the old login limit (5/15min)', () => {
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
    // Make sure the stale value isn't lurking anywhere
    expect(readme).not.toMatch(/login:\s*5/);
  });

  it('README does NOT document the old write limit (100/15min)', () => {
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
    expect(readme).not.toMatch(/(writes|POST|write).*?100\b/);
  });
});

describe('Rate limits actually configured in middleware (regression check)', () => {
  it('src/routes/middleware.ts sets authLimiter max=150', () => {
    const middleware = readFileSync(join(repoRoot, 'src/routes/middleware.ts'), 'utf8');
    expect(middleware).toMatch(/authLimiter\s*=[\s\S]*?max:\s*150/);
  });

  it('src/routes/middleware.ts sets postLimiter max=500', () => {
    const middleware = readFileSync(join(repoRoot, 'src/routes/middleware.ts'), 'utf8');
    expect(middleware).toMatch(/postLimiter\s*=[\s\S]*?max:\s*500/);
  });

  it('src/routes/middleware.ts sets inviteRedeemLimiter max=10', () => {
    const middleware = readFileSync(join(repoRoot, 'src/routes/middleware.ts'), 'utf8');
    expect(middleware).toMatch(/inviteRedeemLimiter\s*=[\s\S]*?max:\s*10/);
  });
});

describe('F-015 false-alarm documentation', () => {
  it('.gitignore has .env* pattern that matches .env.backup.*', () => {
    // The .env* pattern matches any file/dir starting with .env
    // So .env.backup.20260429_124554 is matched by this pattern.
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^\.env\*$/m);
    // And the .env.example exception is preserved
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });
});