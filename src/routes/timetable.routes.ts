import express from 'express';
import { timetableService } from '../../services';
import { requireClassAccess, withWriteQueue, postLimiter } from './middleware';
import { validate, timetableSlotSchema } from '../../src/lib/validation';
import { io } from '../../server';
import type { TimetableSlot } from '../../src/types/db';

export const timetableRouter = express.Router();

timetableRouter.get('/classes/:classId/timetable', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const slots = await timetableService.getByClass(classId);
    const mapped = slots.map((s: any) => ({
      id: s.id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      subject: s.subject,
      lesson: s.lesson
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

timetableRouter.post('/classes/:classId/timetable', requireClassAccess('classId'), postLimiter, validate(timetableSlotSchema), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const { id, dayOfWeek, startTime, endTime, subject, lesson } = req.body;

  await timetableService.insert(id, classId, dayOfWeek, startTime, endTime, subject, lesson);
  res.json({ success: true });
  io?.to(classId).emit('timetable_updated');
}));

timetableRouter.put('/timetable/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const timetableId = req.params.id;
  const { dayOfWeek, startTime, endTime, subject, lesson } = req.body;

  const slot = await timetableService.getById(timetableId, teacherId);
  if (!slot) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }

  await timetableService.update({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, subject, lesson }, timetableId, teacherId);
  res.json({ success: true });
  io?.to((slot as TimetableSlot).class_id).emit('timetable_updated');
}));

timetableRouter.delete('/timetable/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const timetableId = req.params.id;

  const slot = await timetableService.getById(timetableId, teacherId);
  if (!slot) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }

  await timetableService.delete(timetableId, teacherId);
  res.json({ success: true });
  io?.to((slot as TimetableSlot).class_id).emit('timetable_updated');
}));