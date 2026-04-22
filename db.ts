// Re-export from src/db/ module
export { DEFAULTS, getDefaultPassword, createBackup, DB_FILE } from './src/db/connection';
export { initSchema } from './src/db/schema';
export { preparedStatements } from './src/db/statements';
export { cacheGet, cacheSet, cacheInvalidate, cached } from './src/db/cache';
export { enqueueWrite } from './src/db/writeQueue';
export { _db, initConnection } from './src/db/connection';

import dbProxy from './src/db/index';
export default dbProxy;