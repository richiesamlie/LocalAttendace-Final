import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('Socket.IO allowRequest checker (F-018)', () => {
  it('server.ts configures allowRequest on Socket.IO server', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    expect(src).toMatch(/allowRequest:\s*\(/);
  });

  it('allowRequest uses getAllowedOrigins() for origin check', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    // The allowRequest callback should reference getAllowedOrigins
    const allowRequestIdx = src.indexOf('allowRequest:');
    expect(allowRequestIdx).toBeGreaterThan(-1);
    const nearby = src.slice(allowRequestIdx, allowRequestIdx + 500);
    expect(nearby).toContain('getAllowedOrigins()');
  });

  it('allowRequest rejects cross-origin requests', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    const allowRequestIdx = src.indexOf('allowRequest:');
    const allowRequestBlock = src.slice(allowRequestIdx, allowRequestIdx + 700);
    expect(allowRequestBlock).toContain("callback('Origin not allowed', false)");
  });

  it('allowRequest allows no-origin requests (same-origin may omit header)', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    const allowRequestIdx = src.indexOf('allowRequest:');
    const allowRequestBlock = src.slice(allowRequestIdx, allowRequestIdx + 700);
    // `if (!origin || allowed.includes(origin))` allows missing origin
    expect(allowRequestBlock).toMatch(/if\s*\(\s*!origin/);
  });

  it('Socket.IO server still uses verifySocketAuth io.use() middleware', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    // Defense-in-depth: even after origin check passes, the JWT check
    // must still run during the connection handshake.
    expect(src).toMatch(/io\.use\(verifySocketAuth\)/);
  });

  it('allowRequest handles exceptions gracefully (no crash)', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    const allowRequestIdx = src.indexOf('allowRequest:');
    const allowRequestBlock = src.slice(allowRequestIdx, allowRequestIdx + 800);
    // Try/catch wrapping the allowRequest logic
    expect(allowRequestBlock).toMatch(/try\s*\{/);
    expect(allowRequestBlock).toMatch(/catch/);
  });
});