import Database from 'better-sqlite3';
import fs from 'fs';

import { _db, DB_FILE, openDatabase, checkpointWal } from './connection';
import { initSchema } from './schema';
import { preparedStatements, initStatements } from './statements';
import { cacheGet, cacheSet, cacheInvalidate, cached } from './cache';
import { enqueueWrite } from './writeQueue';

// Initialize schema first, then prepare SQL statements
initSchema();
initStatements();

let checkpointInterval: NodeJS.Timeout | null = null;

function startCheckpointInterval(): void {
  if (checkpointInterval) clearInterval(checkpointInterval);
  checkpointInterval = setInterval(() => {
    try {
      _db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (_e) {
      // Ignore checkpoint errors during active transactions
    }
  }, 60000);
}

startCheckpointInterval();

function closeDatabase(): void {
  if (checkpointInterval) clearInterval(checkpointInterval);
  checkpointWal();
  try {
    _db.close();
  } catch (_e) {
    // Ignore close errors during shutdown.
  }
}

process.on('beforeExit', closeDatabase);

function reinitConnection(): void {
  openDatabase();
}

function recompileStatements(): void {
  // Re-initialize all prepared statements
  initStatements();
}

const dbProxy = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'restore') {
      return (buffer: Buffer) => {
        if (checkpointInterval) clearInterval(checkpointInterval);
        try { _db.close(); } catch(_e) {
          // Ignore close errors while restoring DB file.
        }
        try { fs.unlinkSync(DB_FILE + '-wal'); } catch { /* ignore if missing */ }
        try { fs.unlinkSync(DB_FILE + '-shm'); } catch { /* ignore if missing */ }
        fs.writeFileSync(DB_FILE, buffer);
        reinitConnection();
        initSchema();
        recompileStatements();
        startCheckpointInterval();
      };
    }
    if (prop === 'stmt') {
      return preparedStatements;
    }
    if (prop === 'enqueueWrite') {
      return enqueueWrite;
    }
    if (prop === 'cache') {
      return { get: cacheGet, set: cacheSet, invalidate: cacheInvalidate, cached };
    }
    const dbObj = _db as unknown as Record<PropertyKey, unknown>;
    const val = dbObj[prop];
    if (typeof val === 'function') {
      return val.bind(_db);
    }
    return val;
  }
}) as Database.Database & {
  restore: (buf: Buffer) => void;
  stmt: typeof preparedStatements;
  enqueueWrite: typeof enqueueWrite;
  cache: { get: typeof cacheGet; set: typeof cacheSet; invalidate: typeof cacheInvalidate; cached: typeof cached }
};

export default dbProxy;