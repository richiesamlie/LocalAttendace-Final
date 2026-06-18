import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('Content-Security-Policy header (F-010 — already in place)', () => {
  it('server.ts configures helmet with CSP enabled in production', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    expect(src).toContain('helmet(');
    // CSP should be active in production
    expect(src).toMatch(/contentSecurityPolicy:\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]/);
  });

  it('CSP directives are conservative (default-src self, frame/object none)', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    expect(src).toContain("defaultSrc: [\"'self'\"]");
    expect(src).toContain("objectSrc: [\"'none'\"]");
    expect(src).toContain("frameSrc: [\"'none'\"]");
  });

  it('CSP is disabled in dev (Vite injects inline scripts)', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    expect(src).toMatch(/:\s*false,\s*\/\/.*[Dd]ev.*Vite/);
  });

  it('comment notes why unsafe-inline is in styleSrc', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    // The unsafe-inline styleSrc is intentional (Tailwind requirement) — must be commented
    expect(src).toContain('unsafe-inline');
    // Best-effort: confirm there's a comment near the unsafe-inline usage
    const unsafeInlineIdx = src.indexOf('unsafe-inline');
    const nearbyText = src.slice(Math.max(0, unsafeInlineIdx - 100), unsafeInlineIdx + 100);
    expect(nearbyText).toMatch(/(\/\/|\*).*Tailwind|(\/\/|\*).*unsafe-inline/i);
  });

  it('helmet is registered BEFORE routes (so headers apply to all)', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    const helmetIdx = src.indexOf('app.use(helmet(');
    const routesIdx = src.indexOf('app.use("/api"');
    expect(helmetIdx).toBeGreaterThan(-1);
    expect(routesIdx).toBeGreaterThan(-1);
    expect(helmetIdx).toBeLessThan(routesIdx);
  });
});