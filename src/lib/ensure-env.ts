import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

export function ensureEnvFile(rootDir = process.cwd()): void {
  const envPath = path.join(rootDir, '.env');
  const examplePath = path.join(rootDir, '.env.example');

  if (!fs.existsSync(envPath)) {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const defaultPassword = 'admin123';

    let content = '';
    if (fs.existsSync(examplePath)) {
      content = fs.readFileSync(examplePath, 'utf8')
        .replace('JWT_SECRET=change_this_to_a_secure_random_string', `JWT_SECRET=${jwtSecret}`)
        .replace('DEFAULT_ADMIN_PASSWORD=change_this_to_a_secure_password', `DEFAULT_ADMIN_PASSWORD=${defaultPassword}`);
    } else {
      content = `# Teacher Assistant App - Auto-generated\nJWT_SECRET=${jwtSecret}\nDEFAULT_ADMIN_PASSWORD=${defaultPassword}\n`;
    }

    try {
      fs.writeFileSync(envPath, content, 'utf8');
      console.warn('[setup] Generated .env file automatically.');
      console.warn('[setup] Initial admin login: admin / admin123');
      console.warn('[setup] Please change your password after logging in via Admin Dashboard.');
    } catch (e) {
      console.warn('[setup] Could not write .env file to disk:', (e as Error).message);
    }
  }

  // Load environment variables into process.env
  dotenv.config({ path: envPath });

  // Fallback defaults if somehow not set in .env
  if (!process.env.DEFAULT_ADMIN_PASSWORD) {
    process.env.DEFAULT_ADMIN_PASSWORD = 'admin123';
  }
}

// Run immediately when imported
ensureEnvFile();
