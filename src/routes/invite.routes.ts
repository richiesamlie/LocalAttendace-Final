import express from 'express';
import { inviteService, classService } from '../../services';
import type { Invite } from '../types/db';
import { requireAuth, requireRole, withWriteQueue } from './middleware';

export const inviteRouter = express.Router();

inviteRouter.get('/classes/:classId/invites', requireRole('classId', 'teacher'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const invites = await inviteService.getByClass(classId);
    res.json(invites);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

inviteRouter.post('/classes/:classId/invites', requireRole('classId', 'teacher'), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const { role, expiresInHours } = req.body;

  const code = `inv-${crypto.randomUUID().slice(0, 8)}`;
  const expiresAt = new Date(Date.now() + (expiresInHours || 72) * 60 * 60 * 1000).toISOString();

  await inviteService.insert(code, classId, role || 'teacher', classId, expiresAt);
  res.json({ success: true, code, inviteUrl: `/invite/${code}`, role: role || 'teacher', expiresAt });
}));

inviteRouter.delete('/classes/:classId/invites/:code', requireRole('classId', 'teacher'), withWriteQueue(async (req, res) => {
  const code = req.params.code;
  await inviteService.delete(code);
  res.json({ success: true });
}));

inviteRouter.post('/invites/redeem', requireAuth, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Invite code is required' });
  }

  const invite = await inviteService.getByCode(code) as Invite | null | undefined;
  if (!invite) {
    return res.status(404).json({ error: 'Invalid invite code' });
  }

  if (invite.used_by) {
    return res.status(400).json({ error: 'This invite code has already been used' });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This invite code has expired' });
  }

  const classExists = await classService.getById(invite.class_id, teacherId);
  if (!classExists) {
    return res.status(404).json({ error: 'This class no longer exists' });
  }

  const existing = await classService.isClassTeacher(invite.class_id, teacherId);
  if (existing) {
    return res.status(400).json({ error: 'You already have access to this class' });
  }

  await inviteService.use(teacherId, code);
  await classService.addTeacher(invite.class_id, teacherId, invite.role);

  res.json({ success: true, className: (classExists as any)?.name, role: invite.role });
}));