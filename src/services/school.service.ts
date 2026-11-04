import { db, isPostgres, pgQuery, pgQueryOne } from './utils';
import type { School } from '../types/db';

export const DEFAULT_SCHOOL_ID = 'school_default';
export const DEFAULT_SCHOOL_CODE = 'default';

export const schoolService = {
  getByCode(code: string) {
    const normalized = code.trim().toLowerCase();
    if (isPostgres()) {
      return pgQueryOne<School>(
        'SELECT id, code, name, created_at FROM schools WHERE LOWER(code) = $1',
        [normalized]
      );
    }
    return db.stmt.getSchoolByCode.get(normalized) as School | undefined;
  },

  getById(id: string) {
    if (isPostgres()) {
      return pgQueryOne<School>(
        'SELECT id, code, name, created_at FROM schools WHERE id = $1',
        [id]
      );
    }
    return db.stmt.getSchoolById.get(id) as School | undefined;
  },

  getAll() {
    if (isPostgres()) {
      return pgQuery<School>('SELECT id, code, name, created_at FROM schools ORDER BY name');
    }
    return db.stmt.getAllSchools.all() as School[];
  },

  async insert(id: string, code: string, name: string): Promise<School> {
    const normalizedCode = code.trim().toLowerCase();
    const trimmedName = name.trim();
    if (isPostgres()) {
      await pgQuery(
        'INSERT INTO schools (id, code, name) VALUES ($1, $2, $3)',
        [id, normalizedCode, trimmedName]
      );
    } else {
      db.stmt.insertSchool.run(id, normalizedCode, trimmedName);
    }
    return { id, code: normalizedCode, name: trimmedName };
  },
};
