import express from 'express';
import path from 'path';
import fs from 'fs';
import { teacherService, sessionService, settingService, refreshTokenService } from '../../services';
import { hashPassword } from '../../src/lib/bcrypt';
import { safeLog } from '../../src/lib/log-redact';
import { requireAuth, requireAdmin, requireSystemAdmin, resolveCallerSchoolId, withWriteQueue, postLimiter } from './middleware';
import { validate, settingSchema } from '../../src/lib/validation';
import db, { DB_FILE } from '../../db';
import { checkpointWal } from '../db/connection';
import { acquireRestoreLock, releaseRestoreLock } from '../db/writeQueue';
import type { Teacher, SettingRow } from '../../src/types/db';
import { metricsStore } from '../middleware/metricsStore';
import { profileQuery, getAllIndexes, getTableStats, getOptimizationScore } from '../db/profiling';
import { resourceMonitor } from '../middleware/resourceMonitor';

export const adminRouter = express.Router();

// F-011: apply requireAuth + requireAdmin ONCE at the router level.
// Every admin route below now requires an authenticated admin session
// without needing per-handler is_admin checks. The previous pattern
// duplicated this check in 14 handlers and was error-prone if a new
// admin endpoint forgot the check.
adminRouter.use(postLimiter);
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/settings', async (req, res) => {
  try {
    const callerSchoolId = await resolveCallerSchoolId(req);
    const settings = await settingService.getAll(callerSchoolId) as SettingRow[];
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

adminRouter.post('/settings', postLimiter, validate(settingSchema), withWriteQueue(async (req, res) => {
  const { key, value } = req.body;
  const callerSchoolId = await resolveCallerSchoolId(req);
  if (key === 'adminPassword') {
    if (value.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const hash = await hashPassword(value);
    const adminTeacher = (req as express.Request & { adminTeacher?: Teacher }).adminTeacher
      || await teacherService.getByUsername('admin', callerSchoolId) as Teacher | null;
    if (adminTeacher) {
      await teacherService.updatePassword(adminTeacher.id, hash);
      await sessionService.revokeAll(adminTeacher.id);
      await refreshTokenService.revokeAllForTeacher(adminTeacher.id);
    }
  } else {
    await settingService.set(key, value, callerSchoolId);
  }
  return res.json({ success: true });
}));

adminRouter.post('/database/backup', requireSystemAdmin, async (_req, res) => {
  try {
    const dbPath = path.resolve(process.env.DB_FILE || DB_FILE);
    // F-016: async fs.access instead of sync existsSync
    try {
      await fs.promises.access(dbPath);
    } catch {
      return res.status(404).json({ error: 'Database file not found' });
    }
    checkpointWal();
    res.setHeader('Content-Disposition', 'attachment; filename="database.sqlite"');
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.sendFile(dbPath);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to create backup' });
  }
});

adminRouter.post('/database/restore', requireSystemAdmin, async (req, res): Promise<void> => {
  try {
    await db.enqueueWrite(() => {});
    acquireRestoreLock();

    const dbPath = path.resolve(process.env.DB_FILE || DB_FILE);
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
      releaseRestoreLock();
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
      releaseRestoreLock();
      if (!res.headersSent) {
        res.status(400).json({ error: 'Failed to read restore payload' });
      }
    });
    req.on('end', () => {
      if (res.headersSent) return;
      const fileBuffer = Buffer.concat(chunks);
      if (fileBuffer.length < 100 || fileBuffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
        releaseRestoreLock();
        res.status(400).json({ error: 'Invalid SQLite database file' });
        return;
      }
      try {
        db.restore(fileBuffer);
        res.json({ success: true, message: 'Database restored successfully. Refresh to apply changes.' });
      } catch (_err) {
        res.status(500).json({ error: 'Failed to restore database' });
      } finally {
        releaseRestoreLock();
      }
    });
  } catch (_error) {
    releaseRestoreLock();
    res.status(500).json({ error: 'Failed to restore database' });
  }
});

// Performance metrics endpoints (admin only)
adminRouter.get('/metrics', requireSystemAdmin, async (req, res) => {  try {
    // Get time window from query param (in minutes), default to last hour
    const windowMinutes = parseInt(req.query.window as string || '60', 10);
    const windowMs = windowMinutes * 60 * 1000;

    const aggregated = metricsStore.getAggregated(windowMs);
    const summary = metricsStore.getSummary();
    const bufferInfo = metricsStore.getBufferInfo();

    return res.json({
      summary,
      bufferInfo,
      metrics: aggregated,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

adminRouter.get('/metrics/summary', requireSystemAdmin, async (_req, res) => {  try {
    const summary = metricsStore.getSummary();
    const bufferInfo = metricsStore.getBufferInfo();
    return res.json({ summary, bufferInfo });
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    return res.status(500).json({ error: 'Failed to fetch metrics summary' });
  }
});

adminRouter.delete('/metrics', requireSystemAdmin, async (_req, res) => {  try {
    metricsStore.clear();
    return res.json({ success: true, message: 'Metrics cleared' });
  } catch (error) {
    console.error('Error clearing metrics:', error);
    return res.status(500).json({ error: 'Failed to clear metrics' });
  }
});

// Query profiling endpoints (admin only)
adminRouter.post('/profiling/query', requireSystemAdmin, async (req, res) => {  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    const trimmed = sql.trim();
    if (!/^select\b/i.test(trimmed) || trimmed.includes(';')) {
      return res.status(400).json({ error: 'Only single SELECT statements are allowed' });
    }

    const result = profileQuery(trimmed);
    const score = getOptimizationScore(result);

    return res.json({ ...result, score });
  } catch (error) {
    // F-007: do not echo raw SQL or PII values from the error message
    console.error('Error profiling query:', safeLog(error));
    return res.status(500).json({
      error: 'Failed to profile query',
      message: 'Internal error — see server logs',
    });
  }
});

adminRouter.get('/profiling/statements', requireSystemAdmin, async (_req, res) => {
  const sampleQueries = [
    { name: 'getStudentsByClass', sql: "SELECT id, class_id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived FROM students WHERE class_id = 'class_default' AND is_archived = 0 ORDER BY name" },
    { name: 'getRecordsByClass', sql: "SELECT student_id, class_id, date, status, reason FROM attendance_records WHERE class_id = 'class_default'" },
    { name: 'getEventsByClass', sql: "SELECT id, class_id, date, title, type, description FROM events WHERE class_id = 'class_default' ORDER BY date DESC" },
    { name: 'getTimetableByClass', sql: "SELECT id, class_id, day_of_week, start_time, end_time, subject, lesson FROM timetable_slots WHERE class_id = 'class_default' ORDER BY day_of_week, start_time" },
  ];
  const statements = sampleQueries.map(({ name, sql }) => {
    try {
      const profile = profileQuery(sql);
      return { name, profile, score: getOptimizationScore(profile) };
    } catch {
      return null;
    }
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return res.json({
    message: 'Use POST /api/admin/profiling/query with { "sql": "SELECT ..." } to profile specific queries.',
    example: { sql: 'SELECT * FROM students WHERE class_id = ? AND archived = 0' },
    statements,
  });
});

adminRouter.get('/profiling/indexes', requireSystemAdmin, async (_req, res) => {  try {
    const indexes = getAllIndexes();
    return res.json({ indexes });
  } catch (error) {
    console.error('Error fetching indexes:', error);
    return res.status(500).json({ error: 'Failed to fetch indexes' });
  }
});

adminRouter.get('/profiling/stats', requireSystemAdmin, async (_req, res) => {  try {
    const stats = getTableStats();
    const indexes = getAllIndexes();
    
    return res.json({ 
      tables: stats,
      indexCount: indexes.length,
      totalRows: stats.reduce((sum, t) => sum + t.rowCount, 0),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Resource monitoring endpoints (admin only)
adminRouter.get('/resources', requireSystemAdmin, async (_req, res) => {  try {
    const current = resourceMonitor.getCurrent();
    const status = resourceMonitor.getStatus();
    return res.json({ current, status });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

adminRouter.get('/resources/history', requireSystemAdmin, async (req, res) => {  try {
    // Get time window from query param (in minutes), default to last hour
    const windowMinutes = parseInt(req.query.window as string || '60', 10);
    const windowMs = windowMinutes * 60 * 1000;

    const current = resourceMonitor.getCurrent();
    const history = resourceMonitor.getHistory(windowMs);
    const stats = resourceMonitor.getStats(windowMs);
    const status = resourceMonitor.getStatus();

    return res.json({ current, history, stats, status });
  } catch (error) {
    console.error('Error fetching resource history:', error);
    return res.status(500).json({ error: 'Failed to fetch resource history' });
  }
});

adminRouter.get('/resources/alerts', requireSystemAdmin, async (req, res) => {  try {
    // Get time window from query param (in minutes), default to last hour
    const windowMinutes = parseInt(req.query.window as string || '60', 10);
    const windowMs = windowMinutes * 60 * 1000;

    const alerts = resourceMonitor.getAlerts(windowMs);
    return res.json({ alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});