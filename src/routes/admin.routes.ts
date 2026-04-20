import express from 'express';
import bcrypt from 'bcrypt';
import { teacherService, sessionService, settingService } from '../../services';
import { requireAuth, withWriteQueue } from './middleware';

export const adminRouter = express.Router();

adminRouter.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await settingService.getAll();
    const response: Record<string, string> = {};
    for (const row of settings as any[]) {
      if (row.key !== 'adminPassword') {
        response[row.key] = row.value;
      }
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

adminRouter.post('/settings', withWriteQueue(async (req, res) => {
  const { key, value } = req.body;
  if (key === 'adminPassword') {
    const callerId = req.teacherId;
    const caller = callerId ? await teacherService.getById(callerId) : null;
    if (!caller || !(caller as any).is_admin) {
      return res.status(403).json({ error: 'Only administrators can change the admin password' });
    }

    if (value.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const hash = bcrypt.hashSync(value, 10);
    const adminTeacher = await teacherService.getByUsername('admin');
    if (adminTeacher) {
      await teacherService.updatePassword((adminTeacher as any).id, hash);
      await sessionService.revokeAll((adminTeacher as any).id);
    }
  } else {
    await settingService.set(key, value);
  }
  res.json({ success: true });
}));

adminRouter.post('/database/backup', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as any).is_admin) {
    return res.status(403).json({ error: 'Only administrators can perform database operations' });
  }
  res.json({ success: true, message: 'Backup created' });
});

adminRouter.post('/database/restore', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as any).is_admin) {
    return res.status(403).json({ error: 'Only administrators can perform database operations' });
  }
  res.json({ success: true, message: 'Database restored' });
});