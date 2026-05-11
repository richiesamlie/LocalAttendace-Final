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

    expect(content).toContain('await bcrypt.hash(');
    expect(content).not.toContain('bcrypt.hashSync(');
  });

  it('uses async bcrypt.hash in admin password change route (no hashSync)', () => {
    const adminRoutePath = path.join(process.cwd(), 'src', 'routes', 'admin.routes.ts');
    const content = readFileSync(adminRoutePath, 'utf-8');

    expect(content).toContain('await bcrypt.hash(');
    expect(content).not.toContain('bcrypt.hashSync(');
  });
});
