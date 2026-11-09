import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { hashPassword } from '../src/lib/bcrypt';

const DB_FILE = process.env.DB_FILE
  ? path.resolve(process.cwd(), process.env.DB_FILE)
  : path.join(process.cwd(), 'database.sqlite');

async function syncAdminPasswordFromEnv(): Promise<void> {
  const envPassword = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!envPassword) {
    throw new Error('DEFAULT_ADMIN_PASSWORD is missing. Set it in .env first.');
  }

  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`Database file not found at ${DB_FILE}. Start the app once to initialize the database.`);
  }

  const db = new Database(DB_FILE);

  try {
    const admin = db
      .prepare('SELECT id FROM teachers WHERE username = ? LIMIT 1')
      .get('admin') as { id: string } | undefined;

    if (!admin?.id) {
      throw new Error('Admin user not found. Start the app once to initialize the database.');
    }

    const hash = await hashPassword(envPassword);

    db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?').run(hash, admin.id);

    const hasUserSessionsTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get('user_sessions');
    if (hasUserSessionsTable) {
      db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE teacher_id = ?').run(admin.id);
    }

    const hasRefreshTokensTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get('refresh_tokens');
    if (hasRefreshTokensTable) {
      db.prepare("UPDATE refresh_tokens SET used_at = datetime('now') WHERE teacher_id = ? AND used_at IS NULL").run(admin.id);
    }

    console.log('[db:sync-admin-password] Updated admin password hash from .env and revoked existing sessions.');
  } finally {
    db.close();
  }
}

syncAdminPasswordFromEnv().catch((error) => {
  console.error('[db:sync-admin-password] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
