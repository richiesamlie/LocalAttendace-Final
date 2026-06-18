import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, resolve as resolvePath } from 'path';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

// Resolve the repo root by walking up from this test file until we
// find server.ts. Works regardless of where vitest is invoked from
// (some test runners normalize __dirname to the project root).
function findRepoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'server.ts'))) return dir;
    const parent = resolvePath(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const repoRoot = findRepoRoot();

describe('Async error log stream (F-017)', () => {
  it('server.ts uses fs.createWriteStream for server-error.log', () => {
    const src = readFileSync(join(repoRoot, 'server.ts'), 'utf8');
    // errorLogPath defaults to 'server-error.log' (via env var fallback);
    // the createWriteStream call uses the variable.
    expect(src).toMatch(/const\s+errorLogPath\s*=.*['"]server-error\.log['"]/);
    expect(src).toContain('fs.createWriteStream(errorLogPath');
    expect(src).toContain('errorLogStream');
  });

  it('NO fs.appendFileSync calls remain on hot error paths', () => {
    const src = readFileSync(join(repoRoot, 'server.ts'), 'utf8');
    // Comments may still mention the old name; only block real .appendFileSync() calls.
    expect(src).not.toMatch(/fs\.appendFileSync\(/);
  });

  it('uncaughtException handler uses logServerError() helper', () => {
    const src = readFileSync(join(repoRoot, 'server.ts'), 'utf8');
    expect(src).toMatch(/uncaughtException[\s\S]*?logServerError\('UNCAUGHT EXCEPTION'/);
  });

  it('unhandledRejection handler uses logServerError() helper', () => {
    const src = readFileSync(join(repoRoot, 'server.ts'), 'utf8');
    expect(src).toMatch(/unhandledRejection[\s\S]*?logServerError\('UNHANDLED REJECTION'/);
  });

  it('errorLogStream has its own error handler (no crash on stream failure)', () => {
    const src = readFileSync(join(repoRoot, 'server.ts'), 'utf8');
    expect(src).toMatch(/errorLogStream\.on\(['"]error['"]/);
  });

  it('SERVER_ERROR_LOG env var can override the log path', () => {
    const src = readFileSync(join(repoRoot, 'server.ts'), 'utf8');
    expect(src).toContain('SERVER_ERROR_LOG');
  });
});

describe('Async fs migration (F-016)', () => {
  it('admin.routes.ts uses fs.promises.access (not fs.existsSync)', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/admin.routes.ts'), 'utf8');
    expect(src).toContain('fs.promises.access');
    expect(src).not.toMatch(/fs\.existsSync/);
  });

  it('admin.routes.ts uses fs.promises.mkdir (not fs.mkdirSync)', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/admin.routes.ts'), 'utf8');
    expect(src).toContain('fs.promises.mkdir');
    expect(src).not.toMatch(/fs\.mkdirSync/);
  });

  it('admin.routes.ts uses fs.promises.copyFile (not fs.copyFileSync)', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/admin.routes.ts'), 'utf8');
    expect(src).toContain('fs.promises.copyFile');
    expect(src).not.toMatch(/fs\.copyFileSync/);
  });
});