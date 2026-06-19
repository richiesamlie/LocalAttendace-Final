import express from 'express';
import path from 'path';
import fs from 'fs';
import { teacherService, sessionService, settingService } from '../../services';
import { hashPassword } from '../../src/lib/bcrypt';
import { requireAuth, requireAdmin, withWriteQueue, postLimiter } from './middleware';
import { validate, settingSchema } from '../../src/lib/validation';
import db from '../../db';
import type { Teacher, SettingRow } from '../../src/types/db';

export const adminRouter = express.Router();

// F-011: apply requireAuth + requireAdmin ONCE at the router level.
// Every admin route below now requires an authenticated admin session
// without needing per-handler is_admin checks. The previous pattern
// duplicated this check in 14 handlers and was error-prone if a new
// admin endpoint forgot the check.
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/settings', async (_req, res) => {
  try {
    const settings = await settingService.getAll() as SettingRow[];
    const response: Record<string, string> = {};
    for (const row of settings) {
      if (row.key !== 'adminPassword') {
        response[row.key] = row.value;
      }
    }
    return res.json(response);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

adminRouter.post('/settings', postLimiter, validate(settingSchema), withWriteQueue(async (req, res) => {  const { key, value } = req.body;
  if (key === 'adminPassword') {
    if (value.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const hash = await hashPassword(value);
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

adminRouter.post('/database/backup', async (_req, res) => {  try {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    // F-016: async fs.access instead of sync existsSync
    try {
      await fs.promises.access(dbPath);
    } catch {
      return res.status(404).json({ error: 'Database file not found' });
    }
    res.setHeader('Content-Disposition', 'attachment; filename="database.sqlite"');
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.sendFile(dbPath);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to create backup' });
  }
});

adminRouter.post('/database/restore', async (req, res): Promise<void> => {
  try {
    await db.enqueueWrite(() => {});

    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const backupDir = path.join(process.cwd(), 'backups');
    // F-016: async fs.mkdir (recursive) instead of sync existsSync+mkdirSync
    await fs.promises.mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const preRestorePath = path.join(backupDir, `pre-restore-${timestamp}.sqlite`);
    // F-016: async fs.copyFile instead of sync copyFileSync
    try {
      await fs.promises.access(dbPath);
      await fs.promises.copyFile(dbPath, preRestorePath);
    } catch (_ignore) {
      // source DB doesn't exist; skip pre-restore backup
    }
    const maxRestoreBytes = 25 * 1024 * 1024;
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('application/octet-stream')) {
      res.status(415).json({ error: 'Unsupported content type. Use application/octet-stream' });
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxRestoreBytes) {
        res.status(413).json({ error: 'Backup file too large. Maximum 25MB' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', () => {
      if (!res.headersSent) {
        res.status(400).json({ error: 'Failed to read restore payload' });
      }
    });
    req.on('end', () => {
      if (res.headersSent) return;
      const fileBuffer = Buffer.concat(chunks);
      if (fileBuffer.length < 100 || fileBuffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
        res.status(400).json({ error: 'Invalid SQLite database file' });
        return;
      }
      db.restore(fileBuffer);
      res.json({ success: true, message: 'Database restored successfully. Refresh to apply changes.' });
    });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to restore database' });
  }
});