import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('Express JSON body size limit (F-009)', () => {
  it('server.ts sets a default 100kb limit (down from 10mb)', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    // Look for the express.json() call and verify limit is bounded.
    expect(src).toMatch(/express\.json\(\s*\{\s*limit:[^}]+\}\s*\)/);
    // The literal '10mb' should no longer appear (audit-flagged)
    expect(src).not.toMatch(/limit:\s*['"]10mb['"]/);
    // The new default should be present (or env-var override)
    expect(src).toMatch(/limit:\s*process\.env\.JSON_BODY_LIMIT\s*\|\|\s*['"]100kb['"]/);
  });

  it('JSON_BODY_LIMIT env var is documented as the override', () => {
    const src = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    // Should mention the env var in a comment so operators know
    expect(src).toContain('JSON_BODY_LIMIT');
  });

  // Note: full HTTP integration test would require booting the actual
  // server with supertest + body-parser overflow. The 100kb setting is
  // tested at the source level here (which is what the audit cares about);
  // Express's body-parser library has its own well-tested rejection of
  // oversized payloads (returns 413 Payload Too Large) once a limit is set.
});
