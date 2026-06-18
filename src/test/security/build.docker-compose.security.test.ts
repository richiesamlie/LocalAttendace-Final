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

describe('docker-compose security hardening (F-029)', () => {
  it('docker-compose.yml exists', () => {
    expect(existsSync(join(repoRoot, 'docker-compose.yml'))).toBe(true);
  });

  it('sets security_opt: no-new-privileges (prevent SUID escalation)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/security_opt:[\s\S]*?no-new-privileges:true/);
  });

  it('drops ALL Linux capabilities (cap_drop)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/cap_drop:[\s\S]*?-\s*ALL/);
  });

  it('sets resource limits (cpus + memory)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/cpus:\s*['"]?\d+\.\d+['"]?/);
    expect(compose).toMatch(/memory:\s*\d+M/);
  });

  it('sets pids_limit (fork-bomb mitigation)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/pids:\s*\d+/);
  });

  it('sets explicit user (matches Dockerfile nodejs user)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/user:\s*['"]?1001:1001['"]?/);
  });

  it('sets stop_grace_period for clean shutdown', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/stop_grace_period:\s*\d+s/);
  });

  it('uses a named volume for /app/data (not bind mount)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    // Service should reference the named volume, not a host bind mount
    expect(compose).toMatch(/-\s+teacher-assistant-data:\/app\/data/);
    // Top-level volumes section should declare the named volume
    expect(compose).toMatch(/^volumes:[\s\S]*?teacher-assistant-data:/m);
    // Should NOT have the old bind mount format
    expect(compose).not.toMatch(/-\s+\.\/data:\/app\/data/);
  });

  it('uses tmpfs for /app/backups (no host fs pollution)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/target:\s+\/app\/backups/);
    expect(compose).toMatch(/type:\s+tmpfs/);
  });

  it('healthcheck uses node (not wget)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    // The healthcheck test line should reference "node" (in CMD array).
    // Match either inline form (test: ["CMD", "node", ...]) or block form.
    expect(compose).toMatch(/test:\s*\[\s*['"]?CMD['"]?\s*,\s*['"]?node['"]?/);
    // And should NOT use wget (which would require extra packages in alpine)
    expect(compose).not.toMatch(/test:.*wget/);
  });

  it('healthcheck has reasonable start_period (>=10s for slow boot)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    const match = compose.match(/start_period:\s*(\d+)s/);
    expect(match).not.toBeNull();
    if (match) {
      const startPeriod = parseInt(match[1], 10);
      expect(startPeriod).toBeGreaterThanOrEqual(10);
    }
  });

  it('restart policy is set (unless-stopped or always)', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/restart:\s*(unless-stopped|always|on-failure)/);
  });

  it('exposes port 3000', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/ports:[\s\S]*?-\s*['"]?3000:3000['"]?/);
  });

  it('loads env from .env file', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toMatch(/env_file:[\s\S]*?-\s+\.env/);
  });

  it('sets DB_FILE and NODE_ENV environment variables', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    expect(compose).toContain('DB_FILE=/app/data/database.sqlite');
    expect(compose).toContain('NODE_ENV=production');
  });
});