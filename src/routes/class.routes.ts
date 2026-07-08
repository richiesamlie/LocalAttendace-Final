import express from 'express';
import { randomUUID } from 'crypto';
import { classService, teacherService, inviteService, studentService, recordService, eventService, timetableService, noteService, seatingService } from '../../services';
import { requireAuth, requireClassAccess, requireClassOwner, requireRole, withWriteQueue, postLimiter } from './middleware';
import { validate, classSchema, classUpdateSchema, classTeacherAddSchema, classTeacherRoleUpdateSchema, classInviteCreateSchema } from '../../src/lib/validation';
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
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

classRouter.post('/', requireAuth, postLimiter, validate(classSchema), withWriteQueue(async (req, res) => {
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

classRouter.put('/:id', requireAuth, postLimiter, validate(classUpdateSchema), withWriteQueue(async (req, res) => {
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

classRouter.delete('/:id', requireAuth, postLimiter, withWriteQueue(async (req, res) => {
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

classRouter.get('/:classId/dashboard-payload', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const [students, records, events, timetable, dailyNotes, seatingLayout] = await Promise.all([
      studentService.getByClass(classId, false),
      recordService.getByClass(classId),
      eventService.getByClass(classId),
      timetableService.getByClass(classId),
      noteService.getByClass(classId),
      seatingService.getByClass(classId),
    ]);

    const mappedStudents = (students as Array<{
      id: string;
      name: string;
      roll_number?: string | null;
      parent_name?: string | null;
      parent_phone?: string | null;
      is_flagged?: number | boolean;
      is_archived?: number | boolean;
    }>).map((s) => ({
      id: s.id,
      name: s.name,
      rollNumber: s.roll_number ?? '',
      parentName: s.parent_name ?? '',
      parentPhone: s.parent_phone ?? '',
      isFlagged: !!s.is_flagged,
      isArchived: !!s.is_archived,
    }));

    const mappedRecords = (records as Array<{
      student_id: string;
      date: string;
      status: string;
      reason?: string | null;
    }>).map((r) => ({
      studentId: r.student_id,
      date: r.date,
      status: r.status,
      reason: r.reason ?? undefined,
    }));

    const mappedEvents = (events as Array<{
      id: string;
      date: string;
      title: string;
      type: string;
      description?: string | null;
    }>).map((e) => ({
      id: e.id,
      date: e.date,
      title: e.title,
      type: e.type,
      description: e.description ?? undefined,
    }));

    const mappedTimetable = (timetable as Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      subject: string;
      lesson: string;
    }>).map((t) => ({
      id: t.id,
      dayOfWeek: t.day_of_week,
      startTime: t.start_time,
      endTime: t.end_time,
      subject: t.subject,
      lesson: t.lesson,
    }));

    const mappedDailyNotes: Record<string, string> = {};
    for (const n of dailyNotes as Array<{ date: string; note: string }>) {
      mappedDailyNotes[n.date] = n.note;
    }

    const mappedSeatingLayout: Record<string, string> = {};
    for (const seat of seatingLayout as Array<{ seat_id: string; student_id: string | null }>) {
      mappedSeatingLayout[seat.seat_id] = seat.student_id ?? '';
    }

    return res.json({
      students: mappedStudents,
      records: mappedRecords,
      events: mappedEvents,
      timetable: mappedTimetable,
      dailyNotes: mappedDailyNotes,
      seatingLayout: mappedSeatingLayout,
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to fetch dashboard payload' });
  }
});

classRouter.get('/:classId/teachers', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const teachers = await classService.getTeachers(classId);
    return res.json(teachers);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to fetch class teachers' });
  }
});

classRouter.post('/:classId/teachers', requireAuth, postLimiter, validate(classTeacherAddSchema), withWriteQueue(async (req, res) => {
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

classRouter.delete('/:classId/teachers/:teacherId', requireAuth, postLimiter, withWriteQueue(async (req, res) => {
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

classRouter.put('/:classId/teachers/:teacherId/role', requireClassOwner('classId'), postLimiter, validate(classTeacherRoleUpdateSchema), withWriteQueue(async (req, res) => {
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

classRouter.post('/:classId/invites', requireRole('classId', 'teacher'), postLimiter, validate(classInviteCreateSchema), withWriteQueue(async (req, res) => {
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

  const code = `inv-${randomUUID().slice(0, 12)}`;
  await inviteService.insert(code, classId, inviteRole, teacherId, expiresAt);

  const inviteUrl = `${req.protocol}://${req.get('host')}/invite/${code}`;
  return res.json({ success: true, code, inviteUrl, role: inviteRole, expiresAt });
}));

classRouter.get('/:classId/invites', requireRole('classId', 'teacher'), async (req, res) => {
  try {
    await inviteService.deleteExpired();
    const codes = await inviteService.getByClass(req.params.classId);
    return res.json(codes);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to fetch invite codes' });
  }
});

classRouter.delete('/:classId/invites/:code', requireRole('classId', 'teacher'), postLimiter, withWriteQueue(async (req, res) => {
  await inviteService.delete(req.params.code);
  return res.json({ success: true });
}));
