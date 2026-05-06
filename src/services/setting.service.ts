import { db, isPostgres, pgQuery } from './utils';

/**
 * Setting Service
 * 
 * Manages application-wide administrative settings with key-value storage.
 */

export const settingService = {
  getAll() {
    if (isPostgres()) {
      return pgQuery<{ key: string; value: string }>('SELECT key, value FROM admin_settings');
    }
    return db.stmt.getSettings.all();
  },

  set(key: string, value: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO admin_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, value]
      );
    }
    return db.stmt.upsertSetting.run(key, value);
  },
};
