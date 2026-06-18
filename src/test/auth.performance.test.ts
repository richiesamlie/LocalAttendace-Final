import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import * as path from 'path';

describe('Auth performance hardening', () => {
  it('uses async bcrypt.compare in login route (no compareSync)', () => {
    const authRoutePath = path.join(process.cwd(), 'src', 'routes', 'auth.routes.ts');
    const content = readFileSync(authRoutePath, 'utf-8');

    expect(content).toContain('await bcrypt.compare(');
    expect(content).not.toContain('bcrypt.compareSync(');
  });

  it('uses async bcrypt.hash in teacher register route (no hashSync)', () => {
    const teacherRoutePath = path.join(process.cwd(), 'src', 'routes', 'teacher.routes.ts');
    const content = readFileSync(teacherRoutePath, 'utf-8');

    // F-002 refactor (Batch 3) introduced src/lib/bcrypt.ts wrapper module
    // with `hashPassword()` that internally calls bcrypt.hash() async.
    // Accept either the direct call OR the wrapper call — the audit
    // intent (no sync hashing) is what matters.
    const usesAsyncHash =
      content.includes('await bcrypt.hash(') ||
      content.includes('await hashPassword(');
    expect(usesAsyncHash).toBe(true);
    expect(content).not.toContain('bcrypt.hashSync(');
  });

  it('uses async bcrypt.hash in admin password change route (no hashSync)', () => {
    const adminRoutePath = path.join(process.cwd(), 'src', 'routes', 'admin.routes.ts');
    const content = readFileSync(adminRoutePath, 'utf-8');

    // F-002 refactor (Batch 3) introduced src/lib/bcrypt.ts wrapper module
    // with `hashPassword()` that internally calls bcrypt.hash() async.
    // Accept either the direct call OR the wrapper call — the audit
    // intent (no sync hashing) is what matters.
    const usesAsyncHash =
      content.includes('await bcrypt.hash(') ||
      content.includes('await hashPassword(');
    expect(usesAsyncHash).toBe(true);
    expect(content).not.toContain('bcrypt.hashSync(');
  });
});
