import express from 'express';
import bcrypt from 'bcrypt';
import { teacherService, classService } from '../../services';
import { requireAuth, withWriteQueue, postLimiter } from './middleware';
import { validate, teacherSchema } from '../../src/lib/validation';

export const teacherRouter = express.Router();

teacherRouter.get('/', requireAuth, async (req, res) => {
  try {
    const teachers = await teacherService.getAll();
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

teacherRouter.post('/register', requireAuth, postLimiter, validate(teacherSchema), withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password, and name are required' });
  }

  const isGlobalAdmin = await teacherService.getIsAdmin(teacherId);
  const myClasses = await classService.getByTeacher(teacherId);
  const isHomeroom = myClasses.some((c: any) => c.role === 'owner');
  if (!isGlobalAdmin && !isHomeroom) {
    return res.status(403).json({ error: 'Only Administrators or Homeroom Teachers can register new teachers' });
  }

  const existing = await teacherService.getByUsername(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const id = `teacher_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const hash = bcrypt.hashSync(password, 10);
  await teacherService.insert(id, username, hash, name);
  res.json({ success: true, id, username, name });
}));