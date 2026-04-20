import express from 'express';
import { studentService } from '../../services';
import { requireAuth, requireClassAccess, requireClassOwner, withWriteQueue } from './middleware';

export const studentRouter = express.Router();

studentRouter.get('/:classId/students', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const students = await studentService.getByClass(classId);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

studentRouter.post('/:classId/students', requireClassAccess('classId'), withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const classId = req.params.classId;
  const { id, name, rollNumber, parentName, parentPhone, isFlagged } = req.body;

  await studentService.insert(id, classId, name, rollNumber, parentName || null, parentPhone || null, isFlagged ? 1 : 0);
  res.json({ success: true });
}));

studentRouter.put('/:id', withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const studentId = req.params.id;
  const { name, rollNumber, parentName, parentPhone, isFlagged, isArchived } = req.body;

  const student = await studentService.getById(studentId, teacherId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (rollNumber !== undefined) updateData.roll_number = rollNumber;
  if (parentName !== undefined) updateData.parent_name = parentName;
  if (parentPhone !== undefined) updateData.parent_phone = parentPhone;
  if (isFlagged !== undefined) updateData.is_flagged = isFlagged ? 1 : 0;
  if (isArchived !== undefined) updateData.is_archived = isArchived ? 1 : 0;

  await studentService.update(updateData, studentId, teacherId);
  res.json({ success: true });
}));

studentRouter.delete('/:id', withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const studentId = req.params.id;

  const student = await studentService.getById(studentId, teacherId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }

  await studentService.archive(studentId, teacherId);
  res.json({ success: true });
}));