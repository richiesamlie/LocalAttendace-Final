import { db, isPostgres, pgQuery, pgQueryOne, ClassSummary } from './utils';
import { teacherService } from './teacher.service';

/**
 * Class Service
 * 
 * Handles class management including creation, updates, deletion,
 * and teacher access control.
 */

export const classService = {
  async getByTeacher(teacherId: string): Promise<ClassSummary[]> {
    if (isPostgres()) {
      return pgQuery<{ id: string; teacher_id: string; name: string; school_id: string; owner_name: string; role: string }>(
        `SELECT c.id, c.teacher_id, c.name, c.school_id, t.name as owner_name, ct.role
         FROM classes c 
         JOIN class_teachers ct ON c.id = ct.class_id 
         JOIN teachers t ON c.teacher_id = t.id 
         WHERE ct.teacher_id = $1 
         ORDER BY c.name`,
        [teacherId]
      );
    }
    const classes = db.stmt.getClassesByTeacher.all(teacherId) as (ClassSummary & { teacher_id?: string; role?: string })[];
    return classes.map(c => ({
      id: c.id,
      teacher_id: c.teacher_id,
      name: c.name,
      school_id: c.school_id,
      owner_name: c.owner_name,
      role: c.role || 'teacher'
    }));
  },

  async getById(id: string, teacherId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; name: string; teacher_id: string }>(
        `SELECT c.id, c.name, c.teacher_id FROM classes c 
         JOIN class_teachers ct ON c.id = ct.class_id 
         WHERE c.id = $1 AND ct.teacher_id = $2`,
        [id, teacherId]
      );
    }
    return db.stmt.getClassById.get(id, teacherId);
  },

  async getExistingById(id: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; name: string; teacher_id: string; school_id: string }>(
        'SELECT id, name, teacher_id, school_id FROM classes WHERE id = $1',
        [id]
      );
    }
    return db.prepare('SELECT id, name, teacher_id, school_id FROM classes WHERE id = ?').get(id) as { id: string; name: string; teacher_id: string; school_id?: string } | undefined;
  },

  async getAll(schoolId?: string) {
    if (isPostgres()) {
      if (schoolId) {
        return pgQuery<{ id: string; teacher_id: string; name: string; school_id: string; teacher_name: string }>(
          'SELECT c.id, c.teacher_id, c.name, c.school_id, t.name as teacher_name FROM classes c JOIN teachers t ON c.teacher_id = t.id WHERE c.school_id = $1 ORDER BY c.name',
          [schoolId]
        );
      }
      return pgQuery<{ id: string; teacher_id: string; name: string; school_id: string; teacher_name: string }>(
        'SELECT c.id, c.teacher_id, c.name, c.school_id, t.name as teacher_name FROM classes c JOIN teachers t ON c.teacher_id = t.id'
      );
    }
    if (schoolId) {
      return db.stmt.getClassesBySchool.all(schoolId);
    }
    return db.stmt.getAllClasses.all();
  },

  async insert(id: string, teacherId: string, name: string, schoolId: string = 'school_default') {
    if (isPostgres()) {
      await pgQuery(
        'INSERT INTO classes (id, teacher_id, name, school_id) VALUES ($1, $2, $3, $4)',
        [id, teacherId, name, schoolId]
      );
      // Also add creator as 'owner' in class_teachers so requireClassAccess works
      await pgQuery(
        'INSERT INTO class_teachers (class_id, teacher_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [id, teacherId, 'owner']
      );
      return;
    }
    // In SQLite: insert class then immediately add creator as owner in class_teachers
    db.stmt.insertClassWithSchool.run(id, teacherId, name, schoolId);
    db.stmt.insertClassTeacher.run(id, teacherId, 'owner');
  },

  async update(name: string, id: string, teacherId: string) {
    const isAdmin = await teacherService.getIsAdmin(teacherId);
    if (isPostgres()) {
      if (isAdmin) {
        return pgQuery('UPDATE classes SET name = $1, updated_at = NOW() WHERE id = $2', [name, id]);
      }
      return pgQuery('UPDATE classes SET name = $1, updated_at = NOW() WHERE id = $2 AND id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $3)', [name, id, teacherId]);
    }
    if (isAdmin) {
      return db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(name, id);
    }
    return db.stmt.updateClass.run(name, id, teacherId);
  },

  async delete(id: string, teacherId: string) {
    const isAdmin = await teacherService.getIsAdmin(teacherId);
    if (isPostgres()) {
      if (isAdmin) {
        return pgQuery('DELETE FROM classes WHERE id = $1', [id]);
      }
      return pgQuery(
        `DELETE FROM classes WHERE id = $1 AND id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $2 AND role = 'owner')`,
        [id, teacherId]
      );
    }
    if (isAdmin) {
      return db.prepare('DELETE FROM classes WHERE id = ?').run(id);
    }
    return db.stmt.deleteClass.run(id, teacherId);
  },

  async getTeachers(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ teacher_id: string; username: string; name: string; role: string }>(
        `SELECT ct.teacher_id, ct.role, t.username, t.name FROM class_teachers ct 
         JOIN teachers t ON ct.teacher_id = t.id 
         WHERE ct.class_id = $1`,
        [classId]
      );
    }
    return db.stmt.getClassTeachers.all(classId);
  },

  async isClassTeacher(classId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ class_id: string; role: string }>(
        'SELECT class_id, role FROM class_teachers WHERE class_id = $1 AND teacher_id = $2',
        [classId, teacherId]
      );
    }
    return db.stmt.isClassTeacher.get(classId, teacherId);
  },

  async addTeacher(classId: string, teacherId: string, role: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO class_teachers (class_id, teacher_id, role) VALUES ($1, $2, $3) ON CONFLICT (class_id, teacher_id) DO NOTHING',
        [classId, teacherId, role]
      );
    }
    return db.stmt.insertClassTeacher.run(classId, teacherId, role);
  },

  async removeTeacher(classId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM class_teachers WHERE class_id = $1 AND teacher_id = $2', [classId, teacherId]);
    }
    return db.stmt.removeClassTeacher.run(classId, teacherId);
  },

  async updateTeacherRole(role: string, classId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE class_teachers SET role = $1 WHERE class_id = $2 AND teacher_id = $3', [role, classId, teacherId]);
    }
    return db.stmt.updateClassTeacherRole.run(role, classId, teacherId);
  },

  async getOwnedClassCount(teacherId: string): Promise<number> {
    if (isPostgres()) {
      const result = await pgQueryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM class_teachers WHERE teacher_id = $1 AND role = 'owner'`,
        [teacherId]
      );
      return result ? Number(result.count) : 0;
    }
    const result = db.stmt.countOwnedClasses.get(teacherId) as { count: number } | undefined;
    return result?.count || 0;
  },

  async canCreateClass(teacherId: string): Promise<boolean> {
    const count = await this.getOwnedClassCount(teacherId);
    return count === 0;
  },
};
