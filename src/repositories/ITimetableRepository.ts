import type { TimetableSlot } from '../store';

export interface ITimetableRepository {
  getAll(classId: string): Promise<TimetableSlot[]>;
  getById(slotId: string): Promise<TimetableSlot | null>;
  create(classId: string, slot: TimetableSlot): Promise<{ success: boolean }>;
  update(slotId: string, data: Partial<TimetableSlot>): Promise<{ success: boolean }>;
  delete(slotId: string): Promise<{ success: boolean }>;
}
