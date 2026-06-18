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

// F-022: studentRouter is mounted on TWO prefixes by design.
//   - /classes/:classId/students — canonical REST shape (resource under parent)
//   - /students/:classId/students — legacy shape from earlier versions
//
// Both mounts route through the SAME router instance and the SAME RBAC:
//   - requireClassAccess('classId') on class-scoped routes reads
//     req.params.classId regardless of mount prefix.
//   - :id routes call studentService.getById(id, teacherId) which
//     scopes the lookup at the SERVICE layer (not just middleware),
//     so a teacher cannot access another teacher's students regardless
//     of which prefix the request used.
//
// DO NOT remove the legacy /students mount without a coordinated
// frontend migration — clients depend on it. If/when the frontend
// is updated to use /classes exclusively, this mount can be removed.
router.use('/classes', studentRouter); // class-scoped student paths (canonical)
router.use('/students', studentRouter); // legacy alias — see F-022 comment above

// Mount routers that define /classes/:classId/... internally on the root path
router.use('/', recordRouter);
router.use('/', noteRouter);
router.use('/', eventRouter);
router.use('/', timetableRouter);
router.use('/', seatingRouter);

// Mount routers under their direct resource names for direct member access
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
