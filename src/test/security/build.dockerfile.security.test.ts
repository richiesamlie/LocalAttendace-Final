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

describe('Dockerfile hardening (F-028)', () => {
  it('Dockerfile exists', () => {
    expect(existsSync(join(repoRoot, 'Dockerfile'))).toBe(true);
  });

  it('uses multi-stage build (FROM ... AS builder)', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/FROM\s+\S+\s+AS\s+builder/);
    // Final stage should also be FROM
    const fromCount = (dockerfile.match(/^FROM\s/gm) || []).length;
    expect(fromCount).toBeGreaterThanOrEqual(2);
  });

  it('uses node:20-alpine base (minimal)', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toContain('node:20-alpine');
  });

  it('runs as non-root user (USER nodejs)', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/USER\s+nodejs/);
  });

  it('creates non-root user with explicit UID 1001', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/adduser.*-u\s+1001/);
  });

  it('production install uses --omit=dev', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    // Find the SECOND npm ci (the production stage runs after the
    // second FROM). The builder stage's npm ci is for building.
    const allCiCalls = dockerfile.match(/npm ci[^\n]*/g) || [];
    expect(allCiCalls.length).toBeGreaterThanOrEqual(2);
    // The production install should omit dev deps
    const productionCi = allCiCalls[allCiCalls.length - 1];
    expect(productionCi).toContain('--omit=dev');
  });

  it('npm ci uses --ignore-scripts (defense in depth)', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    // Both builder and production stages should use --ignore-scripts
    const npmCiCalls = dockerfile.match(/npm ci[^\n]*/g) || [];
    expect(npmCiCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of npmCiCalls) {
      expect(call).toContain('--ignore-scripts');
    }
  });

  it('exposes port 3000', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/EXPOSE\s+3000/);
  });

  it('has HEALTHCHECK directive', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/HEALTHCHECK/);
  });

  it('HEALTHCHECK uses node http (no wget needed)', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    // The CMD should use node -e with require('http')
    expect(dockerfile).toMatch(/node\s+-e.*require\(['"]http['"]\)/);
  });

  it('sets NODE_ENV=production explicitly', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toContain('NODE_ENV=production');
  });

  it('declares a persistent VOLUME for database', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/VOLUME\s+\["?\/app\/data"?,?\s*\]?/);
  });

  it('pinned npm version installed in production', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/npm install -g npm@\d+\.\d+\.\d+/);
  });
});

describe('.dockerignore hardening (F-028)', () => {
  it('excludes node_modules, dist, .git', () => {
    const ignore = readFileSync(join(repoRoot, '.dockerignore'), 'utf8');
    expect(ignore).toMatch(/^node_modules$/m);
    expect(ignore).toMatch(/^dist$/m);
    expect(ignore).toMatch(/^\.git$/m);
  });

  it('excludes .env patterns (any variant)', () => {
    const ignore = readFileSync(join(repoRoot, '.dockerignore'), 'utf8');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^\.env\.\*$/m);
    expect(ignore).toMatch(/^\.env\.backup\*$/m);
  });

  it('excludes database file and backups', () => {
    const ignore = readFileSync(join(repoRoot, '.dockerignore'), 'utf8');
    expect(ignore).toMatch(/^database\.sqlite$/m);
    expect(ignore).toMatch(/^data$/m);
    expect(ignore).toMatch(/^backups$/m);
  });

  it('excludes logs, coverage, test artifacts', () => {
    const ignore = readFileSync(join(repoRoot, '.dockerignore'), 'utf8');
    expect(ignore).toMatch(/^\*\.log$/m);
    expect(ignore).toMatch(/^coverage$/m);
    expect(ignore).toMatch(/^test-results$/m);
  });

  it('excludes docs (not needed in runtime image)', () => {
    const ignore = readFileSync(join(repoRoot, '.dockerignore'), 'utf8');
    expect(ignore).toMatch(/^docs$/m);
  });

  it('excludes .github and other dev-only dirs', () => {
    const ignore = readFileSync(join(repoRoot, '.dockerignore'), 'utf8');
    expect(ignore).toMatch(/^\.github$/m);
  });
});