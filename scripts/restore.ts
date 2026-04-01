import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'database.sqlite');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

function listBackups(): string[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('database-backup-') && f.endsWith('.sqlite'))
    .sort()
    .reverse();
}

function restore(backupFile: string): void {
  const backupPath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(BACKUP_DIR, backupFile);

  if (!fs.existsSync(backupPath)) {
    console.error(`[RESTORE] Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  // Create a backup of current DB before restoring
  if (fs.existsSync(DB_FILE)) {
    const preRestoreDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(preRestoreDir)) {
      fs.mkdirSync(preRestoreDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const preRestorePath = path.join(preRestoreDir, `pre-restore-${timestamp}.sqlite`);
    fs.copyFileSync(DB_FILE, preRestorePath);
    console.log(`[RESTORE] Current database backed up to: ${preRestorePath}`);
  }

  fs.copyFileSync(backupPath, DB_FILE);
  console.log(`[RESTORE] Database restored from: ${backupPath}`);
}

// Main
const args = process.argv.slice(2);

if (args.includes('--list') || args.includes('-l')) {
  const backups = listBackups();
  if (backups.length === 0) {
    console.log('[RESTORE] No backups found.');
  } else {
    console.log('[RESTORE] Available backups:');
    backups.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
  }
  process.exit(0);
}

if (args.length === 0) {
  const backups = listBackups();
  if (backups.length === 0) {
    console.error('[RESTORE] No backups found. Run npm run db:backup first.');
    process.exit(1);
  }
  console.log(`[RESTORE] Restoring from most recent backup: ${backups[0]}`);
  restore(backups[0]);
} else {
  restore(args[0]);
}
