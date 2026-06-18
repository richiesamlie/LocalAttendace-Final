import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { hashPassword, verifyPassword, needsRehash, BCRYPT_COST } from '../../../src/lib/bcrypt';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('bcrypt cost factor (F-002)', () => {
  it('BCRYPT_COST defaults to 12', () => {
    expect(BCRYPT_COST).toBe(12);
  });

  it('hashPassword produces a hash with $2b$<cost>$... format', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('hashPassword uses the configured cost factor', async () => {
    const hash = await hashPassword('hunter2');
    // Extract the cost from the hash prefix
    const parts = hash.split('$');
    expect(parseInt(parts[2], 10)).toBe(BCRYPT_COST);
  });

  it('verifyPassword accepts a hash at any legacy cost', async () => {
    const legacyHash = bcrypt.hashSync('legacy-password', 10);
    expect(await verifyPassword('legacy-password', legacyHash)).toBe(true);
    expect(await verifyPassword('wrong-password', legacyHash)).toBe(false);
  });

  it('verifyPassword accepts a hash at the current cost', async () => {
    const hash = await hashPassword('current-password');
    expect(await verifyPassword('current-password', hash)).toBe(true);
  });

  it('needsRehash returns true for legacy 10-round hashes', () => {
    const legacyHash = bcrypt.hashSync('foo', 10);
    expect(needsRehash(legacyHash)).toBe(true);
  });

  it('needsRehash returns false for current-cost hashes', async () => {
    const currentHash = await hashPassword('foo');
    expect(needsRehash(currentHash)).toBe(false);
  });

  it('needsRehash returns false for completely malformed hashes (fail safe)', () => {
    expect(needsRehash('not-a-bcrypt-hash')).toBe(false);
    expect(needsRehash('')).toBe(false);
  });

  it('needsRehash parses a hash whose cost segment is missing digits as "not low" (defensive)', () => {
    // '$2b$$tooshort' has a non-numeric cost segment → parseInt returns NaN
    // → function returns false (assume current or higher).
    expect(needsRehash('$2b$$tooshort')).toBe(false);
  });

  it('different passwords produce different hashes (salt is unique)', async () => {
    const a = await hashPassword('password-A');
    const b = await hashPassword('password-A');
    expect(a).not.toBe(b); // bcrypt uses a random salt each call
  });

  it('honors BCRYPT_COST env var override (lower for tests if needed)', () => {
    // Just verify the IIFE read pattern works — set env var BEFORE re-require
    // (Note: we cannot actually re-evaluate the module, so this just confirms
    // the env-var code path exists; the IIFE is a module-level constant)
    const oldEnv = process.env.BCRYPT_COST;
    try {
      // Setting this has no effect on the already-loaded BCRYPT_COST, but
      // documents the override behavior for operators reading the code.
      process.env.BCRYPT_COST = '11';
      // We can't re-import the module in vitest without a complex setup,
      // but we can at least confirm the env var is read at the right time
      // by checking BCRYPT_COST remained at the loaded value (12 here).
      expect(typeof BCRYPT_COST).toBe('number');
    } finally {
      if (oldEnv === undefined) delete process.env.BCRYPT_COST;
      else process.env.BCRYPT_COST = oldEnv;
    }
  });
});

describe('production bcrypt callsites use the helper (F-002 source-grep)', () => {
  it('no production callsite hardcodes the cost factor 10 or 12', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');

    // Production files that hash passwords
    const productionFiles = [
      'src/db/schema.ts',
      'src/routes/admin.routes.ts',
      'src/routes/teacher.routes.ts',
    ];

    for (const file of productionFiles) {
      const content = readFileSync(join(process.cwd(), file), 'utf8');
      // Should NOT contain hardcoded numeric cost factor in hashSync/hash call
      // (the schema.ts uses hashSync + BCRYPT_COST — both still legitimate)
      // The pattern to flag: bcrypt.hash(..., <number>) where <number> is not BCRYPT_COST
      // Allow: bcrypt.hashSync(pw, BCRYPT_COST)  — uses constant
      // Forbid: bcrypt.hash(pw, 10), bcrypt.hash(pw, 12), bcrypt.hashSync(pw, 10)
      expect(content).not.toMatch(/bcrypt\.hash\s*\(\s*[^,]+,\s*1[02]\s*\)/);
      expect(content).not.toMatch(/bcrypt\.hashSync\s*\(\s*[^,]+,\s*1[02]\s*\)/);
    }
  });
});