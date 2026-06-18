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

  // F-012: generic error message for all failure modes. Previously the
  // response distinguished "invalid code" / "already used" / "expired" /
  // "class deleted" / "already have access" — each one confirms whether
  // a guess was close, helping an attacker enumerate codes or fingerprint
  // internal state. The legitimate user just needs to know "your code
  // did not work, ask for a new one".
  const GENERIC_INVITE_ERROR = { error: 'Invalid or expired invite code' };

  if (!invite) {
    return res.status(404).json(GENERIC_INVITE_ERROR);
  }

  if (invite.used_by) {
    return res.status(400).json(GENERIC_INVITE_ERROR);
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json(GENERIC_INVITE_ERROR);
  }

  const classExists = await classService.getExistingById(invite.class_id);
  if (!classExists) {
    return res.status(404).json(GENERIC_INVITE_ERROR);
  }

  const existing = await classService.isClassTeacher(invite.class_id, teacherId);
  if (existing) {
    return res.status(400).json(GENERIC_INVITE_ERROR);
  }

  // F-006: Atomic redemption. The single UPDATE+WHERE guards against
  // the race where two concurrent requests both pass the `used_by` check
  // above and both call the old non-atomic `use()`. Now only one can win.
  const won = await inviteService.useAtomic(teacherId, code);
  if (!won) {
    return res.status(400).json(GENERIC_INVITE_ERROR);
  }

  await classService.addTeacher(invite.class_id, teacherId, invite.role);

  const className = (classExists as ClassNameCarrier | null)?.name;
  return res.json({ success: true, className, role: invite.role });
}));
