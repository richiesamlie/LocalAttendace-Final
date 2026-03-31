import { z } from 'zod';
import express from 'express';

export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const classSchema = z.object({
  id: z.string().max(100),
  name: z.string().min(1).max(200),
});

export const studentSchema = z.object({
  id: z.string().max(100),
  name: z.string().min(1).max(200),
  rollNumber: z.string().min(1).max(100),
  parentName: z.string().optional().nullable(),
  parentPhone: z.string().optional().nullable(),
  isFlagged: z.boolean().optional().default(false),
});

export const attendanceRecordSchema = z.object({
  studentId: z.string().max(100),
  classId: z.string().max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['Present', 'Absent', 'Sick', 'Late']),
  reason: z.string().max(500).optional().nullable(),
});

export const eventSchema = z.object({
  id: z.string().max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  type: z.enum(['Classwork', 'Test', 'Exam', 'Holiday', 'Other']),
  description: z.string().max(1000).optional().nullable(),
});

export const timetableSlotSchema = z.object({
  id: z.string().max(100),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  subject: z.string().min(1).max(200),
  lesson: z.string().min(1).max(200),
});

export const teacherSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(4).max(200),
  name: z.string().min(1).max(200),
});

export const settingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(10000),
});

export function validate(schema: z.ZodSchema) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: error.issues.map(e => ({ field: e.path.join('.'), message: e.message })) 
        });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
