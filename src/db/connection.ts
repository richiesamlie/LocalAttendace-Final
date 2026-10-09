import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), 'database.sqlite');

export const DEFAULTS = {
  TEACHER_ID: 'teacher_default',
  TEACHER_USERNAME: 'admin',
  TEACHER_NAME: 'Administrator',
  CLASS_ID: 'class_default',
  CLASS_NAME: 'My First Class',
} as const;

export function getDefaultPassword(): string {
  return process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
}

export function createBackup(): void {
  try {
    if (!fs.existsSync(DB_FILE)) return;

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `db-${new Date().toISOString().slice(0, 10)}.sqlite`);
    fs.copyFileSync(DB_FILE, backupFile);
    console.log(`[db] Backup created: ${backupFile}`);

    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('db-') && f.endsWith('.sqlite'))
      .map(f => ({ name: f, fullPath: path.join(backupDir, f) }))
      .sort((a, b) => b.name.localeCompare(a.name));

    for (const old of backups.slice(10)) {
      fs.unlinkSync(old.fullPath);
      console.log(`[db] Old backup deleted: ${old.name}`);
    }
  } catch (error) {
    console.error('[db] Backup failed:', error);
  }
}

export let _db = new Database(DB_FILE, { timeout: 5000 });

export function initConnection(): void {
  _db.pragma('foreign_keys = ON');
  _db.pragma('journal_mode = WAL');
  _db.pragma('wal_autocheckpoint = 1000');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('cache_size = -64000');
  _db.pragma('temp_store = MEMORY');
  _db.pragma('mmap_size = 268435456');
}

export function checkpointWal(): void {
  try {
    if (_db && _db.open) {
      _db.pragma('wal_checkpoint(TRUNCATE)');
    }
  } catch (_err) {
    // Non-critical during shutdown
  }
}

export function openDatabase(): Database.Database {
  _db = new Database(DB_FILE, { timeout: 5000 });
  initConnection();
  return _db;
}

initConnection();