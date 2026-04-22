import express from 'express';
import { sessionService } from '../../services';
import { requireAuth, withWriteQueue, postLimiter } from './middleware';
import type { Session } from '../../src/types/db';

export const sessionRouter = express.Router();

sessionRouter.get('/', requireAuth, async (req, res) => {
  try {
    const teacherId = req.teacherId;
    await sessionService.deleteExpired();
    const sessions = await sessionService.getByTeacher(teacherId);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

sessionRouter.post('/revoke', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const { sessionId } = req.body;

  if (sessionId === 'all') {
    await sessionService.revokeAll(teacherId);
    return res.json({ success: true, message: 'All sessions revoked' });
  }

  const session = await sessionService.get(sessionId) as (Session & { teacher_id?: string }) | null | undefined;
  if (!session || session.teacher_id !== teacherId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  await sessionService.revoke(sessionId);
  res.json({ success: true });
}));