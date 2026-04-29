import { db, isPostgres, pgQuery, pgQueryOne } from './utils';

/**
 * Invite Service
 * 
 * Manages invite codes for teachers to join classes with specific roles,
 * including expiration and usage tracking.
 */

export const inviteService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ code: string; role: string; created_by: string; created_at: string; expires_at: string | null; used_by: string | null }>(
        'SELECT code, role, created_by, created_at, expires_at, used_by, used_at FROM invite_codes WHERE class_id = $1 AND used_by IS NULL ORDER BY created_at DESC',
        [classId]
      );
    }
    return db.stmt.getClassInviteCodes.all(classId);
  },

  getByCode(code: string) {
    if (isPostgres()) {
      return pgQueryOne<{ code: string; class_id: string; role: string; expires_at: string; used_by: string | null }>(
        'SELECT code, class_id, role, expires_at, used_by FROM invite_codes WHERE code = $1',
        [code]
      );
    }
    return db.stmt.getInviteCode.get(code);
  },

  insert(code: string, classId: string, role: string, createdBy: string, expiresAt: string | null) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO invite_codes (code, class_id, role, created_by, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [code, classId, role, createdBy, expiresAt]
      );
    }
    return db.stmt.insertInviteCode.run(code, classId, role, createdBy, expiresAt);
  },

  delete(code: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM invite_codes WHERE code = $1', [code]);
    }
    return db.stmt.deleteInviteCode.run(code);
  },

  use(teacherId: string, code: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE invite_codes SET used_by = $1, used_at = NOW() WHERE code = $2', [teacherId, code]);
    }
    return db.stmt.useInviteCode.run(teacherId, code);
  },

  deleteExpired() {
    if (isPostgres()) {
      return pgQuery('DELETE FROM invite_codes WHERE expires_at < NOW()');
    }
    return db.stmt.deleteExpiredInviteCodes.run();
  },
};
