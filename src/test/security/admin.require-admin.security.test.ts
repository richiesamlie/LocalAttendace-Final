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

describe('requireAdmin middleware (F-011)', () => {
  it('middleware.ts exports requireAdmin', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/middleware.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+requireAdmin\s*:\s*RequestHandler/);
  });

  it('requireAdmin looks up the teacher record by req.teacherId', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/middleware.ts'), 'utf8');
    // The middleware reads req.teacherId (set by requireAuth) and looks
    // up the teacher via teacherService.getById.
    expect(src).toMatch(/requireAdmin[\s\S]*?teacherService\.getById\(req\.teacherId\)/);
  });

  it('requireAdmin rejects with 403 when is_admin is falsy', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/middleware.ts'), 'utf8');
    expect(src).toMatch(/!caller\.is_admin/);
    expect(src).toMatch(/res\.status\(403\)/);
  });
});

describe('admin.router uses requireAdmin once at router level (F-011)', () => {
  it('admin.routes.ts applies requireAdmin ONCE at the router level', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/admin.routes.ts'), 'utf8');
    // Single application via adminRouter.use()
    expect(src).toMatch(/adminRouter\.use\(requireAuth,\s*requireAdmin\)/);
  });

  it('admin.routes.ts has NO inline is_admin checks (no caller = teacherService.getById)', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/admin.routes.ts'), 'utf8');
    // Source-grep: the per-handler pattern was 5 lines of caller lookup
    // + is_admin check. After refactoring, none should remain in handlers.
    // The router.use() line above does NOT contain "is_admin" literally,
    // so we count zero occurrences.
    const matches = src.match(/teacherService\.getById\(callerId\)/g) || [];
    expect(matches.length).toBe(0);
  });

  it('admin.routes.ts has NO "Only administrators can" error messages (now generic)', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/admin.routes.ts'), 'utf8');
    // The previous pattern used distinct error messages like
    // 'Only administrators can access settings'. The middleware now
    // returns a single generic 'Administrator access required'.
    const matches = src.match(/Only administrators can/g) || [];
    expect(matches.length).toBe(0);
  });

  it('admin.routes.ts has zero inline admin-check blocks (was 14)', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/admin.routes.ts'), 'utf8');
    // Strip comments before counting so the F-011 explanatory comment
    // doesn't get counted as an "inline check".
    const stripped = src
      .replace(/\/\/.*$/gm, '')           // strip // line comments
      .replace(/\/\*[\s\S]*?\*\//g, '');   // strip /* */ block comments
    // Source-grep: should have ZERO remaining is_admin references
    // outside of comments and the type-only import for Teacher.
    const matches = stripped.match(/is_admin/g) || [];
    expect(matches.length).toBe(0);
  });
});

describe('requireAdmin middleware applies before any admin route (F-011)', () => {
  it('adminRouter.use(requireAdmin) line is BEFORE all adminRouter.get/post calls', () => {
    const src = readFileSync(join(repoRoot, 'src/routes/admin.routes.ts'), 'utf8');
    const useIdx = src.indexOf('adminRouter.use(requireAuth, requireAdmin)');
    const firstGetIdx = src.indexOf('adminRouter.get(');
    const firstPostIdx = src.indexOf('adminRouter.post(');
    const firstRouteIdx = Math.min(
      firstGetIdx === -1 ? Infinity : firstGetIdx,
      firstPostIdx === -1 ? Infinity : firstPostIdx,
    );
    expect(useIdx).toBeGreaterThan(-1);
    expect(firstRouteIdx).toBeGreaterThan(-1);
    expect(useIdx).toBeLessThan(firstRouteIdx);
  });
});