import { db, isPostgres, pgQuery, pgQueryOne } from './utils';

/**
 * Teacher Service
 * 
 * Handles teacher authentication, profile management, and permissions.
 */

export const teacherService = {
  getByUsername(username: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; username: string; password_hash: string; name: string; is_admin: number }>(
        'SELECT id, username, password_hash, name, is_admin FROM teachers WHERE username = $1',
        [username]
      );
    }
    return db.stmt.getTeacherByUsername.get(username);
  },

  getById(id: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; username: string; name: string; is_admin: number }>(
        'SELECT id, username, name, is_admin FROM teachers WHERE id = $1',
        [id]
      );
    }
    return db.stmt.getTeacherById.get(id) as { id: string; username: string; name: string; is_admin: number } | undefined;
  },

  async getIsAdmin(id: string): Promise<boolean> {
    if (isPostgres()) {
      const r = await pgQueryOne<{ is_admin: number }>('SELECT is_admin FROM teachers WHERE id = $1', [id]);
      return !!r?.is_admin;
    }
    const teacher = db.stmt.getTeacherById.get(id) as { is_admin?: number } | undefined;
    return !!teacher?.is_admin;
  },

  updateLastLogin(id: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE teachers SET last_login = NOW() WHERE id = $1', [id]);
    }
    return db.stmt.updateTeacherLastLogin.run(id);
  },

  getAll() {
    if (isPostgres()) {
      return pgQuery<{ id: string; username: string; name: string }>(
        'SELECT id, username, name FROM teachers ORDER BY name'
      );
    }
    return db.stmt.getAllTeachers.all();
  },

  insert(id: string, username: string, hash: string, name: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES ($1, $2, $3, $4, 0)',
        [id, username, hash, name]
      );
    }
    return db.stmt.insertTeacher.run(id, username, hash, name);
  },

  // N12: Updates the actual password_hash in the teachers table.
  updatePassword(teacherId: string, passwordHash: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE teachers SET password_hash = $1 WHERE id = $2', [passwordHash, teacherId]);
    }
    return db.stmt.updateTeacherPassword.run(passwordHash, teacherId);
  },

  // Returns true if the teacher is an owner of at least one class.
  // Used for: allowing teachers to register new teachers.
  async isHomeroom(teacherId: string): Promise<boolean> {
    if (isPostgres()) {
      const result = await pgQueryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM class_teachers WHERE teacher_id = $1 AND role = 'owner'`,
        [teacherId]
      );
      return result ? Number(result.count) > 0 : false;
    }
    const result = db.stmt.countOwnedClasses.get(teacherId) as { count: number } | undefined;
    return (result?.count || 0) > 0;
  },
};
