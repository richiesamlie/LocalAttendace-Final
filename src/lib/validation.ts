import { z } from 'zod';
import express from 'express';

// Sanitize string inputs: trim whitespace and strip null bytes
const sanitizeString = (val: string): string =>
  val.replace(/\x00/g, '').trim();

const safeString = (opts?: { min?: number; max?: number }) =>
  z.string().transform(sanitizeString).pipe(z.string().min(opts?.min ?? 0).max(opts?.max ?? 10000));

export const loginSchema = z.object({
  username: safeString({ min: 1, max: 100 }),
  password: safeString({ min: 1, max: 200 }),
});

export const classSchema = z.object({
  id: safeString({ max: 100 }),
  name: safeString({ min: 1, max: 200 }),
});

export const studentSchema = z.object({
  id: safeString({ max: 100 }),
  name: safeString({ min: 1, max: 200 }),
  rollNumber: safeString({ min: 1, max: 100 }),
  parentName: safeString({ max: 200 }).optional().nullable(),
  parentPhone: safeString({ max: 100 }).optional().nullable(),
  isFlagged: z.boolean().optional().default(false),
});

export const attendanceRecordSchema = z.object({
  studentId: safeString({ max: 100 }),
  classId: safeString({ max: 100 }),
  date: safeString({ min: 1, max: 10 }).refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: 'Invalid date format (expected YYYY-MM-DD)' }),
  status: z.enum(['Present', 'Absent', 'Sick', 'Late']),
  reason: safeString({ max: 500 }).optional().nullable(),
});

export const eventSchema = z.object({
  id: safeString({ max: 100 }),
  date: safeString({ min: 1, max: 10 }).refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: 'Invalid date format (expected YYYY-MM-DD)' }),
  title: safeString({ min: 1, max: 200 }),
  type: z.enum(['Classwork', 'Test', 'Exam', 'Holiday', 'Other']),
  description: safeString({ max: 1000 }).optional().nullable(),
});

export const timetableSlotSchema = z.object({
  id: safeString({ max: 100 }),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: safeString({ min: 1, max: 5 }).refine(v => /^\d{2}:\d{2}$/.test(v), { message: 'Invalid time format (expected HH:MM)' }),
  endTime: safeString({ min: 1, max: 5 }).refine(v => /^\d{2}:\d{2}$/.test(v), { message: 'Invalid time format (expected HH:MM)' }),
  subject: safeString({ min: 1, max: 200 }),
  lesson: safeString({ min: 1, max: 200 }),
});

export const teacherSchema = z.object({
  username: safeString({ min: 1, max: 100 }),
  password: safeString({ min: 4, max: 200 }),
  name: safeString({ min: 1, max: 200 }),
});

export const settingSchema = z.object({
  key: safeString({ min: 1, max: 100 }),
  value: safeString({ min: 1, max: 10000 }),
});

export function validate(schema: z.ZodSchema) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: error.issues.map(e => ({ field: e.path.join('.'), message: e.message })) 
        });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}
