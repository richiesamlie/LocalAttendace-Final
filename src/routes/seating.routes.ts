import express from 'express';
import { seatingService } from '../../services';
import { requireClassAccess, withWriteQueue, postLimiter } from './middleware';
import { io } from '../../server';
import type { SeatingLayoutRow } from '../../src/types/db';

export const seatingRouter = express.Router();

seatingRouter.get('/classes/:classId/seating', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const layout = await seatingService.getByClass(classId) as SeatingLayoutRow[];
    const response: Record<string, string> = {};
    for (const row of layout) {
      response[row.seat_id] = row.student_id ?? '';
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seating layout' });
  }
});

seatingRouter.post('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const { seatId, studentId } = req.body;

  if (studentId === null) {
    await seatingService.deleteSeat(classId, seatId);
  } else {
    await seatingService.deleteStudent(classId, studentId);
    await seatingService.insert(classId, seatId, studentId);
  }
  res.json({ success: true });
  io?.to(classId).emit('seating_updated');
}));

seatingRouter.put('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const layout = req.body as Record<string, string>;

  await seatingService.saveLayout(classId, layout);
  res.json({ success: true });
  io?.to(classId).emit('seating_updated');
}));

seatingRouter.delete('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  await seatingService.clear(classId);
  res.json({ success: true });
  io?.to(classId).emit('seating_updated');
}));