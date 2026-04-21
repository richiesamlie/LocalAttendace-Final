import express from 'express';
import { studentService } from '../../services';
import { requireAuth, requireClassAccess, withWriteQueue, postLimiter } from './middleware';
import { validate, studentSchema } from '../../src/lib/validation';
import { io } from '../../server';

export const studentRouter = express.Router();

studentRouter.get('/:classId/students', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const includeArchived = req.query.includeArchived === 'true';
    const students = await studentService.getByClass(classId, includeArchived);
    const mapped = students.map((s: any) => ({
      id: s.id,
      name: s.name,
      rollNumber: s.roll_number,
      parentName: s.parent_name,
      parentPhone: s.parent_phone,
      isFlagged: !!s.is_flagged,
      isArchived: !!s.is_archived
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

studentRouter.post('/:classId/students', requireClassAccess('classId'), postLimiter, validate(studentSchema), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const { id, name, rollNumber, parentName, parentPhone, isFlagged } = req.body;
  await studentService.insert(id, classId, name, rollNumber, parentName || null, parentPhone || null, isFlagged ? 1 : 0);
  res.json({ success: true });
  io?.to(classId).emit('students_updated');
}));

studentRouter.put('/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const studentId = req.params.id;

  const student = await studentService.getById(studentId, teacherId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }

  const { name, rollNumber, parentName, parentPhone, isFlagged, isArchived } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (rollNumber !== undefined) updateData.roll_number = rollNumber;
  if (parentName !== undefined) updateData.parent_name = parentName;
  if (parentPhone !== undefined) updateData.parent_phone = parentPhone;
  if (isFlagged !== undefined) updateData.is_flagged = isFlagged ? 1 : 0;
  if (isArchived !== undefined) updateData.is_archived = isArchived ? 1 : 0;

  await studentService.update(updateData, studentId, teacherId);
  const updatedStudent = await studentService.getById(studentId, teacherId) as { id: string; class_id: string } | null;
  res.json({ success: true });
  if (updatedStudent) io?.to(updatedStudent.class_id!).emit('students_updated');
}));

studentRouter.delete('/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const studentId = req.params.id;

  const student = await studentService.getById(studentId, teacherId) as { id: string; class_id: string } | null;
  if (!student) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }

  await studentService.archive(studentId, teacherId);
  res.json({ success: true });
  if (student) io?.to(student.class_id!).emit('students_updated');
}));

studentRouter.post('/:classId/students/sync', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const teacherId = req.teacherId;

  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'students must be an array' });
  }

  const existing = await studentService.getByClass(classId);
  const existingMap = new Map<string, any>();
  for (const s of existing as any[]) {
    existingMap.set(s.id, s);
  }

  const toInsert = students.filter((s: any) => !existingMap.has(s.id));
  const toUpdate = students.filter((s: any) => existingMap.has(s.id));

  for (const s of toInsert) {
    await studentService.insert(s.id, classId, s.name, s.rollNumber, s.parentName || null, s.parentPhone || null, s.isFlagged ? 1 : 0);
  }

  for (const s of toUpdate) {
    const updateData: Record<string, unknown> = {
      name: s.name,
      roll_number: s.rollNumber,
      parent_name: s.parentName || null,
      parent_phone: s.parentPhone || null,
      is_flagged: s.isFlagged ? 1 : 0,
      is_archived: s.isArchived ? 1 : 0
    };
    await studentService.update(updateData, s.id, teacherId);
  }

  res.json({ success: true, inserted: toInsert.length, updated: toUpdate.length });
  io?.to(classId).emit('students_updated');
}));