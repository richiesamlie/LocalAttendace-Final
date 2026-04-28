import express from 'express';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import { teacherService, sessionService, settingService } from '../../services';
import { requireAuth, withWriteQueue, postLimiter } from './middleware';
import { validate, settingSchema } from '../../src/lib/validation';
import db from '../../db';
import type { Teacher, SettingRow } from '../../src/types/db';

export const adminRouter = express.Router();

adminRouter.get('/settings', requireAuth, async (_req, res) => {
  try {
    const settings = await settingService.getAll() as SettingRow[];
    const response: Record<string, string> = {};
    for (const row of settings) {
      if (row.key !== 'adminPassword') {
        response[row.key] = row.value;
      }
    }
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

adminRouter.post('/settings', postLimiter, validate(settingSchema), withWriteQueue(async (req, res) => {
  const { key, value } = req.body;
  if (key === 'adminPassword') {
    const callerId = req.teacherId;
    const caller = callerId ? await teacherService.getById(callerId) : null;
    if (!caller || !(caller as Teacher).is_admin) {
      return res.status(403).json({ error: 'Only administrators can change the admin password' });
    }

    if (value.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const hash = bcrypt.hashSync(value, 10);
    const adminTeacher = await teacherService.getByUsername('admin') as Teacher | null;
    if (adminTeacher) {
      await teacherService.updatePassword(adminTeacher.id, hash);
      await sessionService.revokeAll(adminTeacher.id);
    }
  } else {
    await settingService.set(key, value);
  }
  return res.json({ success: true });
}));

adminRouter.post('/database/backup', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    return res.status(403).json({ error: 'Only administrators can perform database operations' });
  }
  try {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }
    res.setHeader('Content-Disposition', 'attachment; filename="database.sqlite"');
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.sendFile(dbPath);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create backup' });
  }
});

adminRouter.post('/database/restore', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    return res.status(403).json({ error: 'Only administrators can perform database operations' });
  }
  try {
    await db.enqueueWrite(() => {});

    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const preRestorePath = path.join(backupDir, `pre-restore-${timestamp}.sqlite`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, preRestorePath);
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const fileBuffer = Buffer.concat(chunks);
      if (fileBuffer.length < 100 || fileBuffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
        return res.status(400).json({ error: 'Invalid SQLite database file' });
      }
      db.restore(fileBuffer);
      return res.json({ success: true, message: 'Database restored successfully. Refresh to apply changes.' });
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to restore database' });
  }
});