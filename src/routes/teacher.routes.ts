import express from 'express';
import bcrypt from 'bcrypt';
import { teacherService } from '../../services';
import { requireAuth, withWriteQueue } from './middleware';

export const teacherRouter = express.Router();

teacherRouter.get('/', requireAuth, async (req, res) => {
  try {
    const teachers = await teacherService.getAll();
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

teacherRouter.post('/register', withWriteQueue(async (req, res) => {
  const { username, password, name } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'username, password, and name are required' });
  }

  const existing = await teacherService.getByUsername(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const isHomeroom = await teacherService.isHomeroom(req.body.teacherId || '');
  if (!isHomeroom) {
    return res.status(403).json({ error: 'Only homeroom teachers can register new teachers' });
  }

  const id = `teacher-${crypto.randomUUID()}`;
  const hash = bcrypt.hashSync(password, 10);

  await teacherService.insert(id, username, hash, name);
  res.json({ success: true, id, username, name });
}));