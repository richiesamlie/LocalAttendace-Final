import express from 'express';
import { classService, teacherService } from '../../services';
import type { ClassWithRole, ClassTeacher } from '../types/db';
import { requireAuth, requireClassAccess, requireClassOwner, withWriteQueue } from './middleware';

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
        owner_name: c.owner_name || (c as any).teacher_name,
        role: 'administrator' as const,
      }));
      return res.json(mapped);
    }

    const classes = await classService.getByTeacher(teacherId);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

classRouter.post('/', withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const { id, name } = req.body;
  await classService.insert(id, teacherId, name);
  res.json({ id, teacher_id: teacherId, name });
}));

classRouter.put('/:id', withWriteQueue(async (req, res) => {
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
  res.json({ success: true });
}));

classRouter.delete('/:id', withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;

  const isGlobalAdmin = await teacherService.getIsAdmin(teacherId);
  if (!isGlobalAdmin) {
    const access = await classService.isClassTeacher(req.params.id, teacherId) as ClassTeacher | null | undefined;
    if (!access || access.role !== 'owner') {
      return res.status(403).json({ error: 'Only the Homeroom Teacher can delete the class' });
    }
  }
  await classService.delete(req.params.id, teacherId);
  res.json({ success: true });
}));

classRouter.get('/:classId/teachers', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const teachers = await classService.getTeachers(classId);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch class teachers' });
  }
});

classRouter.post('/:classId/teachers', withWriteQueue(async (req, res) => {
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
  res.json({ success: true });
}));

classRouter.delete('/:classId/teachers/:teacherId', withWriteQueue(async (req, res) => {
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
  res.json({ success: true });
}));