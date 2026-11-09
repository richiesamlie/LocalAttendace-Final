import { db, isPostgres, pgQuery } from './utils';
import { DEFAULT_SCHOOL_ID } from './school.service';

/**
 * Setting Service
 * 
 * Manages administrative settings with key-value storage, scoped per school.
 */

function toScopedKey(key: string, schoolId?: string): string {
  if (!schoolId || schoolId === DEFAULT_SCHOOL_ID) {
    return key;
  }
  return `${schoolId}:${key}`;
}

export const settingService = {
  async getAll(schoolId?: string) {
    const rows = isPostgres()
      ? await pgQuery<{ key: string; value: string }>('SELECT key, value FROM admin_settings')
      : (db.stmt.getSettings.all() as Array<{ key: string; value: string }>);

    if (!schoolId || schoolId === DEFAULT_SCHOOL_ID) {
      return rows.filter((r) => !r.key.includes(':'));
    }
    const prefix = `${schoolId}:`;
    return rows
      .filter((r) => r.key.startsWith(prefix))
      .map((r) => ({ key: r.key.slice(prefix.length), value: r.value }));
  },

  set(key: string, value: string, schoolId?: string) {
    const scopedKey = toScopedKey(key, schoolId);
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO admin_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [scopedKey, value]
      );
    }
    return db.stmt.upsertSetting.run(scopedKey, value);
  },
};
