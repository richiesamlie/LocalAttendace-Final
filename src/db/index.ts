import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

import { _db, initConnection, DB_FILE } from './connection';
import { initSchema } from './schema';
import { preparedStatements } from './statements';
import { cacheGet, cacheSet, cacheInvalidate, cached } from './cache';
import { enqueueWrite } from './writeQueue';

initSchema();

const checkpointInterval = setInterval(() => {
  try {
    _db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    // Ignore checkpoint errors during active transactions
  }
}, 60000);

process.on('beforeExit', () => {
  clearInterval(checkpointInterval);
  try {
    _db.pragma('wal_checkpoint(TRUNCATE)');
    _db.close();
  } catch (e) {}
});

function reinitConnection(): void {
  initConnection();
}

function recompileStatements(): void {
  for (const key of Object.keys(preparedStatements)) {
    (preparedStatements as any)[key] = _db.prepare((preparedStatements as any)[key].source);
  }
}

const dbProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'restore') {
      return (buffer: Buffer) => {
        clearInterval(checkpointInterval);
        try { _db.close(); } catch(e) {}
        fs.writeFileSync(DB_FILE, buffer);
        reinitConnection();
        initSchema();
        recompileStatements();
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
    const val = (_db as any)[prop];
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