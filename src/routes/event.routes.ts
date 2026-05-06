import express from 'express';
import { eventService } from '../../services';
import { requireClassAccess, withWriteQueue, postLimiter } from './middleware';
import { validate, eventSchema } from '../../src/lib/validation';
import { io } from '../../server';
import type { CalendarEvent } from '../../src/types/db';

export const eventRouter = express.Router();

eventRouter.get('/classes/:classId/events', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const events = await eventService.getByClass(classId);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

eventRouter.post('/classes/:classId/events', requireClassAccess('classId'), postLimiter, validate(eventSchema), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  const events = Array.isArray(req.body) ? req.body : [req.body];
  for (const e of events as any[]) {
    await eventService.insert(e.id, classId, e.date, e.title, e.type, e.description || null);
  }
  res.json({ success: true });
  io?.to(classId).emit('events_updated');
  return;
}));

eventRouter.put('/events/:id', postLimiter, withWriteQueue(async (req, res) => {
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

eventRouter.delete('/events/:id', postLimiter, withWriteQueue(async (req, res) => {
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