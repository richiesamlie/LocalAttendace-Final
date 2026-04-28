import express from 'express';
import { recordService, classService, studentService } from '../../services';
import { requireAuth, requireClassAccess, withWriteQueue, postLimiter } from './middleware';
import { io } from '../../server';

export const recordRouter = express.Router();

recordRouter.get('/classes/:classId/records', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const records = await recordService.getByClass(classId);
    const mapped = records.map((r: any) => ({
      studentId: r.student_id,
      date: r.date,
      status: r.status,
      reason: r.reason
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

recordRouter.post('/', requireAuth, postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const records = Array.isArray(req.body) ? req.body : [req.body];

  for (const r of records as any[]) {
    const access = await classService.isClassTeacher(r.classId, teacherId);
    if (!access) {
      return res.status(404).json({ error: `Class ${r.classId} not found or access denied` });
    }
    const student = await studentService.getBelongsToClass(r.studentId, r.classId);
    if (!student) {
      return res.status(404).json({ error: `Student ${r.studentId} not found in class ${r.classId}` });
    }
  }

  for (const r of records as any[]) {
    await recordService.insert(r.classId, r.studentId, r.date, r.status, r.reason || null);
  }
  res.json({ success: true });
  const classIds = [...new Set(records.map((r: any) => r.classId))];
  classIds.forEach((cid: any) => io?.to(cid).emit('records_updated'));
  return;
}));