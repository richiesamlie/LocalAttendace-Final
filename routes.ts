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
router.use(authRouter);
router.use(classRouter);
router.use(studentRouter);
router.use(recordRouter);
router.use(noteRouter);
router.use(eventRouter);
router.use(timetableRouter);
router.use(seatingRouter);
router.use(inviteRouter);
router.use(sessionRouter);
router.use(teacherRouter);
router.use(adminRouter);
router.use(healthRouter);

export default router;
