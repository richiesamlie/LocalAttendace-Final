import express from 'express';
import { sessionService } from '../../services';
import { requireAuth, withWriteQueue } from './middleware';

export const sessionRouter = express.Router();

sessionRouter.get('/sessions', requireAuth, async (req, res) => {
  try {
    const teacherId = req.teacherId;
    await sessionService.deleteExpired();
    const sessions = await sessionService.getByTeacher(teacherId);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

sessionRouter.post('/sessions/revoke', requireAuth, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const { sessionId } = req.body;

  if (sessionId === 'all') {
    await sessionService.revokeAll(teacherId);
    return res.json({ success: true, message: 'All sessions revoked' });
  }

  const session = await sessionService.get(sessionId);
  if (!session || (session as any).teacher_id !== teacherId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  await sessionService.revoke(sessionId);
  res.json({ success: true });
}));