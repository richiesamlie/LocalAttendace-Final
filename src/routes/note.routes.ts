import express from 'express';
import { noteService } from '../../services';
import { requireClassAccess, withWriteQueue, postLimiter } from './middleware';
import { io } from '../../server';
import type { DailyNote } from '../../src/types/db';

export const noteRouter = express.Router();

noteRouter.get('/classes/:classId/daily-notes', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const notes = await noteService.getByClass(classId) as DailyNote[];
    const response: Record<string, string> = {};
    for (const row of notes) {
      response[row.date] = row.note;
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily notes' });
  }
});

noteRouter.post('/classes/:classId/daily-notes', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const { date, note } = req.body;

  if (!date || note === undefined) {
    return res.status(400).json({ error: 'date and note are required' });
  }

  await noteService.upsert(classId, date, note);
  res.json({ success: true });
  io?.to(classId).emit('notes_updated');
}));