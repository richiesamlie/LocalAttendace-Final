import express from 'express';
import { eventService } from '../../services';
import { requireAuth, requireClassAccess, withWriteQueue, postLimiter } from './middleware';
import { validate, eventPayloadSchema } from '../../src/lib/validation';
import { io } from '../../server';
import type { CalendarEvent } from '../../src/types/db';

interface EventPayload {
  id: string;
  date: string;
  title: string;
  type: string;
  description?: string | null;
}

export const eventRouter = express.Router();

eventRouter.get('/classes/:classId/events', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const events = await eventService.getByClass(classId);
    res.json(events);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

eventRouter.post('/classes/:classId/events', requireClassAccess('classId'), postLimiter, validate(eventPayloadSchema), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  const events = (Array.isArray(req.body) ? req.body : [req.body]) as EventPayload[];
  for (const e of events) {
    await eventService.insert(e.id, classId, e.date, e.title, e.type, e.description || null);
  }
  res.json({ success: true });
  io?.to(classId).emit('events_updated');
  return;
}));

eventRouter.put('/:id', requireAuth, postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const eventId = req.params.id;
  const { date, title, type, description } = req.body;

  const event = await eventService.getById(eventId, teacherId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }

  await eventService.update({ date, title, type, description }, eventId, teacherId);
  res.json({ success: true });
  io?.to((event as CalendarEvent).class_id).emit('events_updated');
  return;
}));

eventRouter.delete('/:id', requireAuth, postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const eventId = req.params.id;

  const event = await eventService.getById(eventId, teacherId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }

  await eventService.delete(eventId, teacherId);
  res.json({ success: true });
  io?.to((event as CalendarEvent).class_id).emit('events_updated');
  return;
}));