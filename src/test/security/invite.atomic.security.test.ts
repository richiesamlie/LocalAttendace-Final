import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import db from '../../../db';
import { inviteService, teacherService } from '../../../services';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('inviteService.useAtomic (F-006)', () => {
  // Each test gets a fresh teacher + class + invite so prior used_by
  // state from other tests cannot bleed in.
  let ownerId: string;
  let classId: string;
  let inviteCode: string;

  beforeEach(async () => {
    ownerId = `tch-owner-${randomUUID().slice(0, 8)}`;
    classId = `cls-${randomUUID().slice(0, 8)}`;
    inviteCode = `inv-${randomUUID().slice(0, 12)}`;

    const passwordHash = bcrypt.hashSync('password123', 10);
    db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(ownerId, `${ownerId}-user`, passwordHash, 'Owner', 0);
    db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)')
      .run(classId, ownerId, 'Atomic Redemption Class');
    db.prepare('INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, ?)')
      .run(classId, ownerId, 'owner');

    await inviteService.insert(inviteCode, classId, 'teacher', ownerId,
      new Date(Date.now() + 60 * 60 * 1000).toISOString());
  });

  afterEach(() => {
    db.prepare('DELETE FROM invite_codes WHERE class_id = ?').run(classId);
    db.prepare('DELETE FROM class_teachers WHERE class_id = ?').run(classId);
    db.prepare('DELETE FROM classes WHERE id = ?').run(classId);
    db.prepare('DELETE FROM teachers WHERE id = ?').run(ownerId);
  });

  it('returns true on first call (we won the race)', async () => {
    const teacherA = `tch-A-${randomUUID().slice(0, 8)}`;
    db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(teacherA, `${teacherA}-user`, bcrypt.hashSync('p', 10), 'A', 0);
    try {
      const won = await inviteService.useAtomic(teacherA, inviteCode);
      expect(won).toBe(true);
    } finally {
      db.prepare('DELETE FROM teachers WHERE id = ?').run(teacherA);
    }
  });

  it('returns false on second call (already used)', async () => {
    const teacherA = `tch-A-${randomUUID().slice(0, 8)}`;
    const teacherB = `tch-B-${randomUUID().slice(0, 8)}`;
    db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(teacherA, `${teacherA}-user`, bcrypt.hashSync('p', 10), 'A', 0);
    db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(teacherB, `${teacherB}-user`, bcrypt.hashSync('p', 10), 'B', 0);
    try {
      const first = await inviteService.useAtomic(teacherA, inviteCode);
      expect(first).toBe(true);
      const second = await inviteService.useAtomic(teacherB, inviteCode);
      expect(second).toBe(false);
    } finally {
      db.prepare('DELETE FROM teachers WHERE id IN (?, ?)').run(teacherA, teacherB);
    }
  });

  it('returns false for non-existent invite code', async () => {
    const teacher = `tch-X-${randomUUID().slice(0, 8)}`;
    db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(teacher, `${teacher}-user`, bcrypt.hashSync('p', 10), 'X', 0);
    try {
      const won = await inviteService.useAtomic(teacher, 'inv-does-not-exist');
      expect(won).toBe(false);
    } finally {
      db.prepare('DELETE FROM teachers WHERE id = ?').run(teacher);
    }
  });

  it('two concurrent calls — exactly one wins', async () => {
    // The race F-006 was added to prevent: two concurrent requests both
    // pass the pre-check (used_by IS NULL) and both try to redeem. The
    // atomic UPDATE+WHERE used_by IS NULL guarantees only one row update.
    const teacherA = `tch-A-${randomUUID().slice(0, 8)}`;
    const teacherB = `tch-B-${randomUUID().slice(0, 8)}`;
    db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(teacherA, `${teacherA}-user`, bcrypt.hashSync('p', 10), 'A', 0);
    db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(teacherB, `${teacherB}-user`, bcrypt.hashSync('p', 10), 'B', 0);
    try {
      const [a, b] = await Promise.all([
        inviteService.useAtomic(teacherA, inviteCode),
        inviteService.useAtomic(teacherB, inviteCode),
      ]);

      const winners = [a, b].filter((x) => x === true).length;
      const losers = [a, b].filter((x) => x === false).length;
      expect(winners).toBe(1);
      expect(losers).toBe(1);
    } finally {
      db.prepare('DELETE FROM teachers WHERE id IN (?, ?)').run(teacherA, teacherB);
    }
  });

  // Sanity: confirm the admin teacher still exists in the seeded DB
  it('admin teacher is seeded in the DB', async () => {
    const admin = await teacherService.getByUsername('admin');
    expect(admin).not.toBeNull();
  });
});