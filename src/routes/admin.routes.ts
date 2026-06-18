import express from 'express';
import path from 'path';
import fs from 'fs';
import { teacherService, sessionService, settingService } from '../../services';
import { hashPassword } from '../../src/lib/bcrypt';
import { safeLog } from '../../src/lib/log-redact';
import { requireAuth, requireAdmin, withWriteQueue, postLimiter } from './middleware';
import { validate, settingSchema } from '../../src/lib/validation';
import db from '../../db';
import type { Teacher, SettingRow } from '../../src/types/db';
import { metricsStore } from '../middleware/metricsStore';
import { profileQuery, profileAllStatements, getAllIndexes, getTableStats, getOptimizationScore } from '../db/profiling';
import { resourceMonitor } from '../middleware/resourceMonitor';

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

// Performance metrics endpoints (admin only)
adminRouter.get('/metrics', async (req, res) => {  try {
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

adminRouter.get('/metrics/summary', async (_req, res) => {  try {
    const summary = metricsStore.getSummary();
    const bufferInfo = metricsStore.getBufferInfo();
    return res.json({ summary, bufferInfo });
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    return res.status(500).json({ error: 'Failed to fetch metrics summary' });
  }
});

adminRouter.delete('/metrics', async (_req, res) => {  try {
    metricsStore.clear();
    return res.json({ success: true, message: 'Metrics cleared' });
  } catch (error) {
    console.error('Error clearing metrics:', error);
    return res.status(500).json({ error: 'Failed to clear metrics' });
  }
});

// Query profiling endpoints (admin only)
adminRouter.post('/profiling/query', async (req, res) => {  try {
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

adminRouter.get('/profiling/statements', async (_req, res) => {  try {
    const results = profileAllStatements();
    const profilesWithScores = Array.from(results.entries()).map(([name, result]) => ({
      name,
      ...result,
      score: getOptimizationScore(result),
    }));

    return res.json({ statements: profilesWithScores });
  } catch (error) {
    console.error('Error profiling statements:', error);
    return res.status(500).json({ error: 'Failed to profile statements' });
  }
});

adminRouter.get('/profiling/indexes', async (_req, res) => {  try {
    const indexes = getAllIndexes();
    return res.json({ indexes });
  } catch (error) {
    console.error('Error fetching indexes:', error);
    return res.status(500).json({ error: 'Failed to fetch indexes' });
  }
});

adminRouter.get('/profiling/stats', async (_req, res) => {  try {
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
adminRouter.get('/resources', async (_req, res) => {  try {
    const current = resourceMonitor.getCurrent();
    const status = resourceMonitor.getStatus();
    return res.json({ current, status });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

adminRouter.get('/resources/history', async (req, res) => {  try {
    // Get time window from query param (in minutes), default to last hour
    const windowMinutes = parseInt(req.query.window as string || '60', 10);
    const windowMs = windowMinutes * 60 * 1000;

    const history = resourceMonitor.getHistory(windowMs);
    const stats = resourceMonitor.getStats(windowMs);
    const status = resourceMonitor.getStatus();

    return res.json({ history, stats, status });
  } catch (error) {
    console.error('Error fetching resource history:', error);
    return res.status(500).json({ error: 'Failed to fetch resource history' });
  }
});

adminRouter.get('/resources/alerts', async (req, res) => {  try {
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