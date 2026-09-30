import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ensureEnvFile } from '../lib/ensure-env';

describe('ensureEnvFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('generates a new .env file when none exists', () => {
    const envFile = path.join(tmpDir, '.env');
    expect(fs.existsSync(envFile)).toBe(false);

    ensureEnvFile(tmpDir);

    expect(fs.existsSync(envFile)).toBe(true);
    const content = fs.readFileSync(envFile, 'utf8');
    expect(content).toContain('JWT_SECRET=');
    expect(content).toContain('DEFAULT_ADMIN_PASSWORD=admin123');
    // JWT_SECRET should be 64 hex characters (32 bytes)
    const match = content.match(/JWT_SECRET=([0-9a-f]{64})/i);
    expect(match).not.toBeNull();
  });

  it('preserves existing .env file and does not overwrite it', () => {
    const envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, 'JWT_SECRET=existing_custom_secret\nDEFAULT_ADMIN_PASSWORD=my_secure_pw\n');

    ensureEnvFile(tmpDir);

    const content = fs.readFileSync(envFile, 'utf8');
    expect(content).toContain('existing_custom_secret');
    expect(content).toContain('my_secure_pw');
  });

  it('substitutes placeholders from .env.example if present in root', () => {
    const exampleFile = path.join(tmpDir, '.env.example');
    fs.writeFileSync(
      exampleFile,
      'JWT_SECRET=change_this_to_a_secure_random_string\nDEFAULT_ADMIN_PASSWORD=change_this_to_a_secure_password\nPORT=3000\n'
    );

    ensureEnvFile(tmpDir);

    const envFile = path.join(tmpDir, '.env');
    const content = fs.readFileSync(envFile, 'utf8');
    expect(content).not.toContain('change_this_to_a_secure_random_string');
    expect(content).not.toContain('change_this_to_a_secure_password');
    expect(content).toContain('PORT=3000');
    expect(content).toContain('DEFAULT_ADMIN_PASSWORD=admin123');
  });
});
