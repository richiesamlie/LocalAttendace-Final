import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
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

describe('Dead GEMINI_API_KEY define removed (F-027)', () => {
  it('vite.config.ts no longer defines GEMINI_API_KEY', () => {
    const src = readFileSync(join(repoRoot, 'vite.config.ts'), 'utf8');
    // Strip comments before searching to avoid the explanatory comment
    const stripped = src
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/GEMINI_API_KEY/);
  });

  it('vite.config.ts still defines VITE_APP_VERSION (the one real env var)', () => {
    const src = readFileSync(join(repoRoot, 'vite.config.ts'), 'utf8');
    expect(src).toContain('VITE_APP_VERSION');
  });

  it('No production source file in src/ references GEMINI_API_KEY', () => {
    // Walk the src/ tree and confirm no production .ts/.tsx file references
    // GEMINI_API_KEY. Test files (under src/test/) may legitimately mention
    // it as part of regression tests, so we skip those.
    const srcDir = join(repoRoot, 'src');
    const stack = [srcDir];
    const offenders: string[] = [];
    while (stack.length > 0) {
      const dir = stack.pop();
      if (!dir) continue;
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          // Skip test directories — they reference this string to verify
          // it's gone from production code.
          if (entry === 'test' || entry === '__tests__') continue;
          stack.push(fullPath);
        } else if (/\.(ts|tsx)$/.test(entry)) {
          const text = readFileSync(fullPath, 'utf8');
          if (text.includes('GEMINI_API_KEY')) {
            offenders.push(fullPath);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});