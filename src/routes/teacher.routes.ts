import express from 'express';
import { teacherService, classService, schoolService, DEFAULT_SCHOOL_ID } from '../../services';
import { hashPassword } from '../../src/lib/bcrypt';
import { requireAuth, resolveCallerSchoolId, withWriteQueue, postLimiter } from './middleware';
import { validate, teacherSchema } from '../../src/lib/validation';

interface ClassRole {
  role?: string;
}

export const teacherRouter = express.Router();

teacherRouter.get('/', requireAuth, async (req, res) => {
  try {
    const callerSchoolId = await resolveCallerSchoolId(req);
    const teachers = await teacherService.getAll(callerSchoolId);
    return res.json(teachers);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to fetch teachers' });
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
  const isHomeroom = myClasses.some((c) => (c as ClassRole).role === 'owner');
  if (!isGlobalAdmin && !isHomeroom) {
    return res.status(403).json({ error: 'Only Administrators or Homeroom Teachers can register new teachers' });
  }

  const callerSchoolId = await resolveCallerSchoolId(req);
  let storedUsername = username.trim();
  if (callerSchoolId !== DEFAULT_SCHOOL_ID) {
    const school = await schoolService.getById(callerSchoolId);
    const schoolCode = school?.code;
    if (schoolCode && !storedUsername.endsWith(`@${schoolCode}`)) {
      const baseUser = storedUsername.includes('@') ? storedUsername.split('@')[0].trim() : storedUsername;
      storedUsername = `${baseUser}@${schoolCode}`;
    }
  }

  const existing = await teacherService.getByUsername(storedUsername, callerSchoolId);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const id = `teacher_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const hash = await hashPassword(password);
  await teacherService.insert(id, storedUsername, hash, name, callerSchoolId, 0);
  return res.json({ success: true, id, username: storedUsername, name, schoolId: callerSchoolId });
}));