import type { CalendarEvent } from '../store';

export interface IEventRepository {
  getAll(classId: string): Promise<CalendarEvent[]>;
  getById(eventId: string): Promise<CalendarEvent | null>;
  create(classId: string, events: CalendarEvent[]): Promise<{ success: boolean }>;
  update(eventId: string, data: Partial<CalendarEvent>): Promise<{ success: boolean }>;
  delete(eventId: string): Promise<{ success: boolean }>;
}
