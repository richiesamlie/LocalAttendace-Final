import express from 'express';
import { inviteService, classService } from '../../services';
import type { Invite } from '../types/db';
import { requireAuth, withWriteQueue, inviteRedeemLimiter } from './middleware';
import { validate, inviteRedeemSchema } from '../../src/lib/validation';

interface ClassNameCarrier {
  name: string;
}

export const inviteRouter = express.Router();

// F-008: stricter per-IP rate limit on /redeem (10 / 15 min) to prevent
// invite-code enumeration attacks. Sequential via withWriteQueue below
// ensures consistency; the rate limit gates burst attempts first.
inviteRouter.post('/redeem', requireAuth, inviteRedeemLimiter, validate(inviteRedeemSchema), withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const { code } = req.body;

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

  const classExists = await classService.getExistingById(invite.class_id);
  if (!classExists) {
    return res.status(404).json({ error: 'This class no longer exists' });
  }

  const existing = await classService.isClassTeacher(invite.class_id, teacherId);
  if (existing) {
    return res.status(400).json({ error: 'You already have access to this class' });
  }

  // F-006: Atomic redemption. The single UPDATE+WHERE guards against
  // the race where two concurrent requests both pass the `used_by` check
  // above and both call the old non-atomic `use()`. Now only one can win.
  const won = await inviteService.useAtomic(teacherId, code);
  if (!won) {
    return res.status(400).json({ error: 'This invite code has already been used' });
  }

  await classService.addTeacher(invite.class_id, teacherId, invite.role);

  const className = (classExists as ClassNameCarrier | null)?.name;
  return res.json({ success: true, className, role: invite.role });
}));
