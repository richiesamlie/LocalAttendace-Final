import express from 'express';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import { teacherService, sessionService, settingService } from '../../services';
import { requireAuth, withWriteQueue, postLimiter } from './middleware';
import { validate, settingSchema } from '../../src/lib/validation';
import db from '../../db';
import type { Teacher, SettingRow } from '../../src/types/db';
import { metricsStore } from '../middleware/metricsStore';
import { profileQuery, profileAllStatements, getAllIndexes, getTableStats, getOptimizationScore } from '../db/profiling';

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

adminRouter.post('/database/restore', requireAuth, async (req, res): Promise<void> => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    res.status(403).json({ error: 'Only administrators can perform database operations' });
    return;
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
        res.status(400).json({ error: 'Invalid SQLite database file' });
        return;
      }
      db.restore(fileBuffer);
      res.json({ success: true, message: 'Database restored successfully. Refresh to apply changes.' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore database' });
  }
});

// Performance metrics endpoints (admin only)
adminRouter.get('/metrics', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    return res.status(403).json({ error: 'Only administrators can view metrics' });
  }

  try {
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

adminRouter.get('/metrics/summary', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    return res.status(403).json({ error: 'Only administrators can view metrics' });
  }

  try {
    const summary = metricsStore.getSummary();
    const bufferInfo = metricsStore.getBufferInfo();
    return res.json({ summary, bufferInfo });
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    return res.status(500).json({ error: 'Failed to fetch metrics summary' });
  }
});

adminRouter.delete('/metrics', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    return res.status(403).json({ error: 'Only administrators can clear metrics' });
  }

  try {
    metricsStore.clear();
    return res.json({ success: true, message: 'Metrics cleared' });
  } catch (error) {
    console.error('Error clearing metrics:', error);
    return res.status(500).json({ error: 'Failed to clear metrics' });
  }
});

// Query profiling endpoints (admin only)
adminRouter.post('/profiling/query', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    return res.status(403).json({ error: 'Only administrators can profile queries' });
  }

  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    const result = profileQuery(sql);
    const score = getOptimizationScore(result);
    
    return res.json({ ...result, score });
  } catch (error) {
    console.error('Error profiling query:', error);
    return res.status(500).json({ 
      error: 'Failed to profile query',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

adminRouter.get('/profiling/statements', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    return res.status(403).json({ error: 'Only administrators can view profiling data' });
  }

  try {
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

adminRouter.get('/profiling/indexes', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    return res.status(403).json({ error: 'Only administrators can view indexes' });
  }

  try {
    const indexes = getAllIndexes();
    return res.json({ indexes });
  } catch (error) {
    console.error('Error fetching indexes:', error);
    return res.status(500).json({ error: 'Failed to fetch indexes' });
  }
});

adminRouter.get('/profiling/stats', requireAuth, async (req, res) => {
  const callerId = req.teacherId;
  const caller = callerId ? await teacherService.getById(callerId) : null;
  if (!caller || !(caller as Teacher).is_admin) {
    return res.status(403).json({ error: 'Only administrators can view stats' });
  }

  try {
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