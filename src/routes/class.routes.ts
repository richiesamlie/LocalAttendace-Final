import express from 'express';
import { classService, teacherService, inviteService } from '../../services';
import { requireAuth, requireClassAccess, requireClassOwner, requireRole, withWriteQueue, postLimiter } from './middleware';
import { validate, classSchema } from '../../src/lib/validation';
import type { ClassWithRole, ClassTeacher } from '../../src/types/db';

export const classRouter = express.Router();

classRouter.get('/', requireAuth, async (req, res) => {
  try {
    const teacherId = req.teacherId;

    const isGlobalAdmin = await teacherService.getIsAdmin(teacherId);
    if (isGlobalAdmin) {
      const allClasses = await classService.getAll() as ClassWithRole[];
      const mapped = allClasses.map((c) => ({
        id: c.id,
        teacher_id: c.teacher_id,
        name: c.name,
        owner_name: c.owner_name || c.teacher_name,
        role: 'administrator' as const,
      }));
      return res.json(mapped);
    }

    const classes = await classService.getByTeacher(teacherId);
    return res.json(classes);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

classRouter.post('/', postLimiter, validate(classSchema), withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;

  const isGlobalAdmin = await teacherService.getIsAdmin(teacherId);
  if (!isGlobalAdmin) {
    const canCreate = await classService.canCreateClass(teacherId);
    if (!canCreate) {
      return res.status(403).json({ error: 'You already manage a Homeroom class. To teach other classes, please ask their owners to invite you as a Subject Teacher.' });
    }
  }

  const { id, name } = req.body;
  await classService.insert(id, teacherId, name);
  return res.json({ id, teacher_id: teacherId, name });
}));

classRouter.put('/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Class name is required' });
  }
  if (name.trim().length > 200) {
    return res.status(400).json({ error: 'Class name must be 200 characters or less' });
  }

  const isGlobalAdmin = await teacherService.getIsAdmin(teacherId);
  if (!isGlobalAdmin) {
    const access = await classService.isClassTeacher(req.params.id, teacherId) as ClassTeacher | null | undefined;
    if (!access || access.role !== 'owner') {
      return res.status(403).json({ error: 'Only the Homeroom Teacher can update the class' });
    }
  }
  await classService.update(name.trim(), req.params.id, teacherId);
  return res.json({ success: true });
}));

classRouter.delete('/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;

  const isGlobalAdmin = await teacherService.getIsAdmin(teacherId);
  if (!isGlobalAdmin) {
    const access = await classService.isClassTeacher(req.params.id, teacherId) as ClassTeacher | null | undefined;
    if (!access || access.role !== 'owner') {
      return res.status(403).json({ error: 'Only the Homeroom Teacher can delete the class' });
    }
  }
  await classService.delete(req.params.id, teacherId);
  return res.json({ success: true });
}));

classRouter.get('/:classId/teachers', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const teachers = await classService.getTeachers(classId);
    return res.json(teachers);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch class teachers' });
  }
});

classRouter.post('/:classId/teachers', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const classId = req.params.classId;

  const access = await classService.isClassTeacher(classId, teacherId) as ClassTeacher | null | undefined;
  if (!access || access.role !== 'owner') {
    return res.status(403).json({ error: 'Only the Homeroom Teacher can add other teachers' });
  }

  const { teacherId: newTeacherId } = req.body;
  if (!newTeacherId) {
    return res.status(400).json({ error: 'teacherId is required' });
  }

  const existing = await teacherService.getById(newTeacherId);
  if (!existing) {
    return res.status(404).json({ error: 'Teacher not found' });
  }

  const hasAccess = await classService.isClassTeacher(classId, newTeacherId);
  if (hasAccess) {
    return res.status(400).json({ error: 'Teacher already has access to this class' });
  }

  await classService.addTeacher(classId, newTeacherId, 'teacher');
  return res.json({ success: true });
}));

classRouter.delete('/:classId/teachers/:teacherId', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const classId = req.params.classId;
  const targetTeacherId = req.params.teacherId;

  const access = await classService.isClassTeacher(classId, teacherId) as ClassTeacher | null | undefined;
  if (!access || access.role !== 'owner') {
    return res.status(403).json({ error: 'Only the Homeroom Teacher can remove other teachers' });
  }

  if (targetTeacherId === teacherId) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
  }

  await classService.removeTeacher(classId, targetTeacherId);
  return res.json({ success: true });
}));

classRouter.put('/:classId/teachers/:teacherId/role', requireClassOwner('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const targetTeacherId = req.params.teacherId;
  const { role } = req.body;

  const validRoles = ['owner', 'teacher', 'assistant'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const existing = await classService.isClassTeacher(classId, targetTeacherId);
  if (!existing) {
    return res.status(404).json({ error: 'Teacher not found in this class' });
  }

  await classService.updateTeacherRole(role, classId, targetTeacherId);
  return res.json({ success: true });
}));

classRouter.post('/:classId/invites', requireRole('classId', 'teacher'), postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const classId = req.params.classId;
  const { role, expiresInHours } = req.body;

  const validRoles = ['teacher', 'assistant'];
  const inviteRole = role || 'teacher';
  if (!validRoles.includes(inviteRole)) {
    return res.status(400).json({ error: 'Invalid role. Must be teacher or assistant' });
  }

  const expiryHours = Math.min(Math.max(Number(expiresInHours) || 48, 1), 720);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  const code = `inv-${crypto.randomUUID().slice(0, 12)}`;
  await inviteService.insert(code, classId, inviteRole, teacherId, expiresAt);

  const inviteUrl = `${req.protocol}://${req.get('host')}/invite/${code}`;
  return res.json({ success: true, code, inviteUrl, role: inviteRole, expiresAt });
}));

classRouter.get('/:classId/invites', requireRole('classId', 'teacher'), async (req, res) => {
  try {
    await inviteService.deleteExpired();
    const codes = await inviteService.getByClass(req.params.classId);
    return res.json(codes);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch invite codes' });
  }
});

classRouter.delete('/:classId/invites/:code', requireRole('classId', 'teacher'), postLimiter, withWriteQueue(async (req, res) => {
  await inviteService.delete(req.params.code);
  return res.json({ success: true });
}));