import { db, isPostgres, pgQuery, pgQueryOne } from './utils';

/**
 * Session Service
 * 
 * Manages user authentication sessions including creation, validation,
 * activity tracking, and revocation.
 */

export const sessionService = {
  insert(sessionId: string, teacherId: string, deviceName: string, ipAddress: string, expiresAt: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [sessionId, teacherId, deviceName, ipAddress, expiresAt]
      );
    }
    return db.stmt.insertSession.run(sessionId, teacherId, deviceName, ipAddress, expiresAt);
  },

  get(sessionId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ is_revoked: number; expires_at: string }>(
        'SELECT is_revoked, expires_at FROM user_sessions WHERE id = $1',
        [sessionId]
      );
    }
    return db.stmt.getSession.get(sessionId);
  },

  updateActivity(sessionId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE user_sessions SET last_active = NOW() WHERE id = $1', [sessionId]);
    }
    try { db.stmt.updateSessionActivity.run(sessionId); } catch { /* non-critical */ }
    return undefined;
  },

  deleteExpired() {
    if (isPostgres()) {
      return pgQuery('DELETE FROM user_sessions WHERE expires_at < NOW()');
    }
    return db.stmt.deleteExpiredSessions.run();
  },

  getByTeacher(teacherId: string) {
    if (isPostgres()) {
      return pgQuery<{ id: string; device_name: string; ip_address: string; created_at: string; last_active: string; expires_at: string; is_revoked: number }>(
        'SELECT id, device_name, ip_address, created_at, last_active, expires_at, is_revoked FROM user_sessions WHERE teacher_id = $1 ORDER BY created_at DESC',
        [teacherId]
      );
    }
    return db.stmt.getSessionsByTeacher.all(teacherId);
  },

  revokeAll(teacherId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE user_sessions SET is_revoked = true WHERE teacher_id = $1', [teacherId]);
    }
    return db.stmt.revokeAllSessions.run(teacherId);
  },

  revoke(sessionId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE user_sessions SET is_revoked = true WHERE id = $1', [sessionId]);
    }
    return db.stmt.revokeSession.run(sessionId);
  },
};
