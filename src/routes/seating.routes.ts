import express from 'express';
import { seatingService } from '../../services';
import { requireAuth, requireClassAccess, withWriteQueue } from './middleware';

export const seatingRouter = express.Router();

seatingRouter.get('/classes/:classId/seating', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const layout = await seatingService.getByClass(classId);
    const response: Record<string, string> = {};
    for (const row of layout as any[]) {
      response[row.seat_id] = row.student_id ?? '';
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seating layout' });
  }
});

seatingRouter.post('/classes/:classId/seating', requireClassAccess('classId'), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const { seatId, studentId } = req.body;

  if (!seatId) {
    return res.status(400).json({ error: 'seatId is required' });
  }

  await seatingService.insert(classId, seatId, studentId || null);
  res.json({ success: true });
}));

seatingRouter.put('/classes/:classId/seating', requireClassAccess('classId'), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const layout = req.body;

  await seatingService.saveLayout(classId, layout);
  res.json({ success: true });
}));

seatingRouter.delete('/classes/:classId/seating', requireClassAccess('classId'), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  await seatingService.clear(classId);
  res.json({ success: true });
}));