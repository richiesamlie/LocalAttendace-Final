/**
 * API Routes Aggregator
 * 
 * This file aggregates all API routes from src/routes/ and exports
 * a single router for use in server.ts.
 */

import express from 'express';
import { 
  authRouter, 
  classRouter, 
  studentRouter, 
  recordRouter, 
  eventRouter, 
  noteRouter, 
  timetableRouter, 
  seatingRouter, 
  inviteRouter, 
  sessionRouter, 
  teacherRouter, 
  adminRouter, 
  healthRouter 
} from './src/routes';

const router = express.Router();

// Mount all route modules
router.use('/auth', authRouter);
router.use('/classes', classRouter);
router.use('/students', studentRouter);
router.use('/records', recordRouter);
router.use('/notes', noteRouter);
router.use('/events', eventRouter);
router.use('/timetable', timetableRouter);
router.use('/seating', seatingRouter);
router.use('/invites', inviteRouter);
router.use('/sessions', sessionRouter);
router.use('/teachers', teacherRouter);
router.use('/admin', adminRouter);
router.use('/', healthRouter);

export default router;
